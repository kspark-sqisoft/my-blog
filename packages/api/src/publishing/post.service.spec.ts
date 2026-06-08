import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';
import { PostService, type Actor } from './post.service';
import { TagService } from './tag.service';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('PostService (통합)', () => {
  let moduleRef: TestingModule;
  let service: PostService;
  let prisma: PrismaService;
  let authorId: string;
  let adminActor: Actor;

  const authorEmail = 'pub-author@example.com';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PostService, TagService],
    }).compile();
    service = moduleRef.get(PostService);
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();
    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
      name: '글쓴이',
    });
    authorId = user.id;
    adminActor = { id: authorId, role: 'ADMIN' };
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await moduleRef?.close();
  });

  it('create 시 status=DRAFT, authorId가 설정된 Post를 반환한다', async () => {
    const post = await service.create({
      title: '첫 글',
      contentMarkdown: '# 본문',
      authorId,
      tags: ['nestjs', 'ddd'],
    });
    expect(post.status).toBe('DRAFT');
    expect(post.authorId).toBe(authorId);
    expect(post.authorName).toBe('글쓴이');
    expect(post.title).toBe('첫 글');
    expect(post.publishedAt).toBeNull();
    expect([...post.tags].sort()).toEqual(['ddd', 'nestjs']);
  });

  // 슬러그 (ADR-0022)
  it('create 시 제목에서 슬러그를 부여한다(한글 보존)', async () => {
    const post = await service.create({
      title: 'NestJS 입문',
      contentMarkdown: 'x',
      authorId,
    });
    expect(post.slug).toBe('nestjs-입문');
  });

  it('같은 제목이면 슬러그를 -2, -3 으로 유일화한다', async () => {
    const a = await service.create({
      title: '중복',
      contentMarkdown: 'x',
      authorId,
    });
    const b = await service.create({
      title: '중복',
      contentMarkdown: 'x',
      authorId,
    });
    const c = await service.create({
      title: '중복',
      contentMarkdown: 'x',
      authorId,
    });
    expect(a.slug).toBe('중복');
    expect(b.slug).toBe('중복-2');
    expect(c.slug).toBe('중복-3');
  });

  it('getPublishedDetail 은 slug 와 cuid 둘 다로 조회된다', async () => {
    const created = await service.create({
      title: '조회 테스트',
      contentMarkdown: 'x',
      authorId,
    });
    await service.publish(created.id, adminActor);
    const bySlug = await service.getPublishedDetail(created.slug);
    expect(bySlug.id).toBe(created.id);
    const byId = await service.getPublishedDetail(created.id);
    expect(byId.id).toBe(created.id);
    expect(byId.slug).toBe(created.slug);
  });

  // 소유권 (ADR-0018)
  it('AUTHOR는 본인 글을 수정/발행/삭제할 수 있다', async () => {
    const created = await service.create({
      title: '내 글',
      contentMarkdown: 'x',
      authorId,
    });
    const owner: Actor = { id: authorId, role: 'AUTHOR' };
    const upd = await service.update(created.id, { title: '수정' }, owner);
    expect(upd.title).toBe('수정');
    const pub = await service.publish(created.id, owner);
    expect(pub.status).toBe('PUBLISHED');
    await service.remove(created.id, owner);
    expect(
      await prisma.post.findUnique({ where: { id: created.id } }),
    ).toBeNull();
  });

  it('AUTHOR가 타인 글을 수정/발행/삭제하면 ForbiddenException(403)', async () => {
    const created = await service.create({
      title: '남의 글',
      contentMarkdown: 'x',
      authorId,
    });
    const stranger: Actor = { id: 'stranger-id', role: 'AUTHOR' };
    await expect(
      service.update(created.id, { title: 'x' }, stranger),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.publish(created.id, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.remove(created.id, stranger)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('ADMIN은 타인 글도 수정/삭제할 수 있다', async () => {
    const created = await service.create({
      title: '타인 글',
      contentMarkdown: 'x',
      authorId,
    });
    const otherAdmin: Actor = { id: 'admin-2', role: 'ADMIN' };
    const upd = await service.update(
      created.id,
      { title: '관리자 수정' },
      otherAdmin,
    );
    expect(upd.title).toBe('관리자 수정');
    await service.remove(created.id, otherAdmin);
  });

  it('없는 글은 권한 판정보다 먼저 NotFound(404)로 처리된다', async () => {
    const stranger: Actor = { id: 'x', role: 'AUTHOR' };
    await expect(
      service.update('no-such-id', { title: 'x' }, stranger),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update는 title/contentMarkdown/tags 부분 수정을 반영한다', async () => {
    const created = await service.create({
      title: '원본',
      contentMarkdown: '원본 본문',
      authorId,
      tags: ['a'],
    });
    const updated = await service.update(
      created.id,
      {
        title: '수정됨',
        contentMarkdown: '수정 본문',
        tags: ['b', 'c'],
      },
      adminActor,
    );
    expect(updated.title).toBe('수정됨');
    expect(updated.contentMarkdown).toBe('수정 본문');
    expect([...updated.tags].sort()).toEqual(['b', 'c']);
  });

  it('존재하지 않는 id update → NotFoundException', async () => {
    await expect(
      service.update('no-such-id', { title: 'x' }, adminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('존재하지 않는 id remove → NotFoundException', async () => {
    await expect(
      service.remove('no-such-id', adminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove는 Post를 삭제한다', async () => {
    const created = await service.create({
      title: '삭제 대상',
      contentMarkdown: 'x',
      authorId,
    });
    await service.remove(created.id, adminActor);
    const found = await prisma.post.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it('publish → status=PUBLISHED, publishedAt 설정', async () => {
    const created = await service.create({
      title: '발행할 글',
      contentMarkdown: 'x',
      authorId,
    });
    const published = await service.publish(created.id, adminActor);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();
  });

  it('unpublish → status=DRAFT, publishedAt 정리', async () => {
    const created = await service.create({
      title: '토글',
      contentMarkdown: 'x',
      authorId,
    });
    await service.publish(created.id, adminActor);
    const draft = await service.unpublish(created.id, adminActor);
    expect(draft.status).toBe('DRAFT');
    expect(draft.publishedAt).toBeNull();
  });

  it('이미 발행된 글을 다시 publish해도 publishedAt이 유지된다(멱등)', async () => {
    const created = await service.create({
      title: '멱등',
      contentMarkdown: 'x',
      authorId,
    });
    const first = await service.publish(created.id, adminActor);
    const second = await service.publish(created.id, adminActor);
    expect(second.status).toBe('PUBLISHED');
    expect(second.publishedAt).toBe(first.publishedAt);
  });

  it('초안을 unpublish해도 안전하게 DRAFT를 유지한다', async () => {
    const created = await service.create({
      title: '초안',
      contentMarkdown: 'x',
      authorId,
    });
    const res = await service.unpublish(created.id, adminActor);
    expect(res.status).toBe('DRAFT');
  });

  it('없는 id publish/unpublish → NotFoundException', async () => {
    await expect(
      service.publish('no-such-id', adminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.unpublish('no-such-id', adminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listPublished는 발행된 Post만 최신순으로 반환한다(초안 제외)', async () => {
    const draft = await service.create({
      title: '초안',
      contentMarkdown: 'd',
      authorId,
    });
    const a = await service.create({
      title: 'A',
      contentMarkdown: 'a',
      authorId,
    });
    const b = await service.create({
      title: 'B',
      contentMarkdown: 'b',
      authorId,
    });
    await service.publish(a.id, adminActor);
    await service.publish(b.id, adminActor); // b가 더 늦게 발행

    const page = await service.listPublished({ page: 1, pageSize: 10 });
    const ids = page.items.map((p) => p.id);
    expect(ids).not.toContain(draft.id);
    expect(ids[0]).toBe(b.id); // 최신순
    expect(ids).toContain(a.id);
    // 목록 항목에 작성자 이름이 포함된다 (ADR-0017)
    expect(page.items[0].authorName).toBe('글쓴이');
  });

  it('listPublished는 page/pageSize로 페이지네이션하고 total을 포함한다', async () => {
    for (const t of ['p1', 'p2', 'p3']) {
      const p = await service.create({
        title: t,
        contentMarkdown: t,
        authorId,
      });
      await service.publish(p.id, adminActor);
    }
    const first = await service.listPublished({ page: 1, pageSize: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(3);
    expect(first.page).toBe(1);
    const second = await service.listPublished({ page: 2, pageSize: 2 });
    expect(second.items).toHaveLength(1);
  });

  it('listPublished는 tag로 필터링한다', async () => {
    const withX = await service.create({
      title: 'hasX',
      contentMarkdown: 'x',
      authorId,
      tags: ['x'],
    });
    const withY = await service.create({
      title: 'hasY',
      contentMarkdown: 'y',
      authorId,
      tags: ['y'],
    });
    await service.publish(withX.id, adminActor);
    await service.publish(withY.id, adminActor);

    const page = await service.listPublished({
      page: 1,
      pageSize: 10,
      tag: 'x',
    });
    const ids = page.items.map((p) => p.id);
    expect(ids).toContain(withX.id);
    expect(ids).not.toContain(withY.id);
    expect(page.total).toBe(1);
  });

  // T-PUB-107: 작성자별 발행글 필터(author-profile)
  it('listPublished는 authorId로 작성자별 발행글만 필터링한다', async () => {
    const mine = await service.create({
      title: '내 발행글',
      contentMarkdown: 'x',
      authorId,
      tags: [],
    });
    await service.publish(mine.id, adminActor);
    // 다른 작성자의 발행글
    const other = await prisma.user.create({
      data: {
        email: `pub107-${Date.now()}@example.com`,
        passwordHash: 'x',
        name: '다른이',
        role: 'AUTHOR',
      },
    });
    // assertion 실패에도 다른 작성자 데이터가 blog_test 에 남아 다른 테스트(total 카운트)를
    // 오염시키지 않도록 try/finally 로 정리를 보장한다.
    try {
      const theirs = await prisma.post.create({
        data: {
          slug: `o-${Date.now()}`,
          title: '남의 발행글',
          contentMarkdown: 'x',
          authorId: other.id,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      const page = await service.listPublished({
        page: 1,
        pageSize: 10,
        authorId,
      });
      expect(page.items.every((p) => p.authorId === authorId)).toBe(true);
      expect(page.items.map((p) => p.id)).not.toContain(theirs.id);
    } finally {
      await prisma.post.deleteMany({ where: { authorId: other.id } });
      await prisma.user.delete({ where: { id: other.id } });
    }
  });

  // T-PUB-107: 키워드 검색(제목·본문 부분일치, 대소문자 무시)
  it('listPublished는 q로 제목/본문을 부분일치 검색한다(대소문자 무시)', async () => {
    const byTitle = await service.create({
      title: 'NestJS 입문',
      contentMarkdown: '서버 기초',
      authorId,
    });
    const byBody = await service.create({
      title: '잡담',
      contentMarkdown: '오늘 nestjs 강의를 들었다',
      authorId,
    });
    const noMatch = await service.create({
      title: '여행기',
      contentMarkdown: '제주도 후기',
      authorId,
    });
    await service.publish(byTitle.id, adminActor);
    await service.publish(byBody.id, adminActor);
    await service.publish(noMatch.id, adminActor);

    const page = await service.listPublished({
      page: 1,
      pageSize: 10,
      q: 'nestjs',
    });
    const ids = page.items.map((p) => p.id);
    expect(ids).toContain(byTitle.id); // 제목 대소문자 무시 매칭
    expect(ids).toContain(byBody.id); // 본문 매칭
    expect(ids).not.toContain(noMatch.id);
    expect(page.total).toBe(2);
  });

  it('listPublished는 q가 비면(공백 포함) 전체를 반환한다', async () => {
    const a = await service.create({
      title: 'A',
      contentMarkdown: 'a',
      authorId,
    });
    const b = await service.create({
      title: 'B',
      contentMarkdown: 'b',
      authorId,
    });
    await service.publish(a.id, adminActor);
    await service.publish(b.id, adminActor);

    const page = await service.listPublished({
      page: 1,
      pageSize: 10,
      q: '   ',
    });
    const ids = page.items.map((p) => p.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  it('listPublished는 본문 첫 이미지를 coverImageUrl로 노출한다(없으면 null)', async () => {
    const withImg = await service.create({
      title: '커버 있음',
      contentMarkdown: '소개\n\n![대표](/uploads/cover.png)\n\n본문',
      authorId,
    });
    const noImg = await service.create({
      title: '커버 없음',
      contentMarkdown: '이미지 없는 본문',
      authorId,
    });
    await service.publish(withImg.id, adminActor);
    await service.publish(noImg.id, adminActor);

    const page = await service.listPublished({ page: 1, pageSize: 10 });
    const byId = new Map(page.items.map((p) => [p.id, p]));
    expect(byId.get(withImg.id)?.coverImageUrl).toBe('/uploads/cover.png');
    expect(byId.get(noImg.id)?.coverImageUrl).toBeNull();
  });

  it('getPublishedDetail은 발행된 Post 상세를 tags 포함해 반환한다', async () => {
    const created = await service.create({
      title: '상세',
      contentMarkdown: '# 본문\n내용',
      authorId,
      tags: ['x', 'y'],
    });
    await service.publish(created.id, adminActor);

    const detail = await service.getPublishedDetail(created.id);
    expect(detail.id).toBe(created.id);
    expect(detail.contentMarkdown).toContain('# 본문');
    expect(detail.status).toBe('PUBLISHED');
    expect([...detail.tags].sort()).toEqual(['x', 'y']);
  });

  it('getPublishedDetail은 초안을 NotFoundException으로 숨긴다', async () => {
    const draft = await service.create({
      title: '초안',
      contentMarkdown: 'x',
      authorId,
    });
    await expect(service.getPublishedDetail(draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getPublishedDetail은 없는 id → NotFoundException', async () => {
    await expect(
      service.getPublishedDetail('no-such-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listForAdmin은 초안+발행을 모두 status 포함해 최신순 반환한다', async () => {
    const draft = await service.create({
      title: '관리 초안',
      contentMarkdown: 'd',
      authorId,
    });
    const pub = await service.create({
      title: '관리 발행',
      contentMarkdown: 'p',
      authorId,
      tags: ['admin'],
    });
    await service.publish(pub.id, adminActor);

    const page = await service.listForAdmin(
      { page: 1, pageSize: 10 },
      adminActor,
    );
    const ids = page.items.map((p) => p.id);
    expect(ids).toContain(draft.id);
    expect(ids).toContain(pub.id);

    const byId = new Map(page.items.map((p) => [p.id, p]));
    expect(byId.get(draft.id)?.status).toBe('DRAFT');
    expect(byId.get(pub.id)?.status).toBe('PUBLISHED');
    expect(page.total).toBeGreaterThanOrEqual(2);
  });

  it('listForAdmin은 page/pageSize 페이지네이션을 지원한다', async () => {
    for (const t of ['a', 'b', 'c']) {
      await service.create({ title: t, contentMarkdown: t, authorId });
    }
    const first = await service.listForAdmin(
      { page: 1, pageSize: 2 },
      adminActor,
    );
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(3);
  });

  // ADR-0019: 운영자 목록은 actor로 스코프 — AUTHOR 본인 글만, ADMIN 전체
  it('listForAdmin은 AUTHOR에게 본인 글만 반환한다', async () => {
    const mine = await service.create({
      title: '내 글',
      contentMarkdown: 'm',
      authorId,
    });
    const owner: Actor = { id: authorId, role: 'AUTHOR' };
    const stranger: Actor = { id: 'stranger-id', role: 'AUTHOR' };

    const ownerPage = await service.listForAdmin(
      { page: 1, pageSize: 10 },
      owner,
    );
    expect(ownerPage.items.map((p) => p.id)).toContain(mine.id);

    const strangerPage = await service.listForAdmin(
      { page: 1, pageSize: 10 },
      stranger,
    );
    expect(strangerPage.items.map((p) => p.id)).not.toContain(mine.id);
    expect(strangerPage.total).toBe(0);
  });

  it('getForAdmin은 초안도 contentMarkdown·status 포함해 반환한다', async () => {
    const draft = await service.create({
      title: '관리 단건 초안',
      contentMarkdown: '# 초안 본문',
      authorId,
      tags: ['x'],
    });
    const detail = await service.getForAdmin(draft.id, adminActor);
    expect(detail.id).toBe(draft.id);
    expect(detail.status).toBe('DRAFT');
    expect(detail.contentMarkdown).toContain('# 초안 본문');
    expect([...detail.tags]).toEqual(['x']);
  });

  // ADR-0019: AUTHOR는 본인 글만 편집 로드 가능 (타인 글 403, 없으면 404 우선)
  it('getForAdmin은 AUTHOR가 본인 글이면 반환, 타인 글이면 403', async () => {
    const draft = await service.create({
      title: '소유 글',
      contentMarkdown: '본문',
      authorId,
    });
    const owner: Actor = { id: authorId, role: 'AUTHOR' };
    const stranger: Actor = { id: 'stranger-id', role: 'AUTHOR' };

    const detail = await service.getForAdmin(draft.id, owner);
    expect(detail.id).toBe(draft.id);
    await expect(
      service.getForAdmin(draft.id, stranger),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getForAdmin은 없는 id → NotFoundException', async () => {
    await expect(
      service.getForAdmin('no-such-id', adminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // T-READ-104: 관련 글 (태그 겹침 우선 → 최신 보완, 자기 제외, 발행글만)
  describe('getRelated (관련 글)', () => {
    // 발행글 생성 + publishedAt 지정(정렬 검증용)
    async function publishWith(
      title: string,
      tags: string[],
      publishedAt: string,
    ) {
      const draft = await service.create({
        title,
        contentMarkdown: `# ${title}`,
        authorId,
        tags,
      });
      await service.publish(draft.id, adminActor);
      await prisma.post.update({
        where: { id: draft.id },
        data: { publishedAt: new Date(publishedAt) },
      });
      return draft;
    }

    it('공유 태그가 많은 글을 먼저, 그다음 publishedAt 최신순으로 정렬한다', async () => {
      const source = await publishWith('소스', ['a', 'b'], '2026-01-01');
      const two = await publishWith('둘공유', ['a', 'b'], '2026-01-02'); // 2겹침
      const one = await publishWith('하나공유', ['a'], '2026-06-01'); // 1겹침(더 최신)

      const related = await service.getRelated(source.slug, 4);
      // 겹친 수가 우선 → two(2) 가 one(1) 보다 먼저(최신이어도)
      expect(related.map((r) => r.id)).toEqual([two.id, one.id]);
    });

    it('공유 태그가 부족하면 최신 글로 채운다', async () => {
      const source = await publishWith('소스2', ['a'], '2026-01-01');
      const shared = await publishWith('공유', ['a'], '2026-02-01');
      const recentNew = await publishWith('최신', ['z'], '2026-06-05');
      const recentOld = await publishWith('옛날', ['y'], '2026-03-01');

      const related = await service.getRelated(source.slug, 3);
      // 겹침 글(shared) 먼저, 나머지는 최신순(recentNew → recentOld)
      expect(related.map((r) => r.id)).toEqual([
        shared.id,
        recentNew.id,
        recentOld.id,
      ]);
    });

    it('초안은 관련 글에 포함하지 않는다', async () => {
      const source = await publishWith('소스3', ['a'], '2026-01-01');
      const draft = await service.create({
        title: '초안공유',
        contentMarkdown: 'x',
        authorId,
        tags: ['a'],
      });
      const pub = await publishWith('발행공유', ['a'], '2026-02-01');

      const ids = (await service.getRelated(source.slug, 4)).map((r) => r.id);
      expect(ids).toContain(pub.id);
      expect(ids).not.toContain(draft.id);
    });

    it('limit 을 넘지 않고 자기 자신을 제외한다', async () => {
      const source = await publishWith('소스4', ['a'], '2026-01-01');
      await publishWith('p1', ['a'], '2026-02-01');
      await publishWith('p2', ['a'], '2026-03-01');
      await publishWith('p3', ['a'], '2026-04-01');

      const related = await service.getRelated(source.slug, 2);
      expect(related).toHaveLength(2);
      expect(related.map((r) => r.id)).not.toContain(source.id);
    });

    it('관련 글 항목은 id·slug·title·tags·publishedAt·coverImageUrl 를 담는다', async () => {
      const source = await publishWith('소스5', ['a'], '2026-01-01');
      await publishWith('이웃', ['a'], '2026-02-01');

      const [first] = await service.getRelated(source.slug, 4);
      expect(first).toMatchObject({
        title: '이웃',
        tags: ['a'],
      });
      expect(typeof first.id).toBe('string');
      expect(typeof first.slug).toBe('string');
      expect(first).toHaveProperty('publishedAt');
      expect(first).toHaveProperty('coverImageUrl');
    });

    it('발행되지 않았거나 없는 글의 관련 글은 NotFound', async () => {
      await expect(
        service.getRelated('no-such-slug', 4),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
