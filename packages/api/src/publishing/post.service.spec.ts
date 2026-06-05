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
});
