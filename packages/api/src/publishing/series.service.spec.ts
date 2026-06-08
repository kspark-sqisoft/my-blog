import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';
import { SeriesService } from './series.service';
import type { Actor } from './post.service';

// T-SER-002: SeriesService 생성·수정·삭제 + 권한 (ADR-0029)
describe('SeriesService (통합, T-SER-002)', () => {
  let moduleRef: TestingModule;
  let service: SeriesService;
  let prisma: PrismaService;
  let ownerId: string;
  let strangerId: string;
  let ownerActor: Actor;
  let strangerActor: Actor;
  let adminActor: Actor;

  const ownerEmail = 'ser2-owner@example.com';
  const strangerEmail = 'ser2-stranger@example.com';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [SeriesService],
    }).compile();
    service = moduleRef.get(SeriesService);
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();
    const owner = await seedOperator(prisma, {
      email: ownerEmail,
      password: 'x',
      name: '시리즈주인',
    });
    ownerId = owner.id;
    const stranger = await prisma.user.create({
      data: {
        email: strangerEmail,
        passwordHash: 'x',
        name: '타인',
        role: 'AUTHOR',
      },
    });
    strangerId = stranger.id;
    ownerActor = { id: ownerId, role: 'AUTHOR' };
    strangerActor = { id: strangerId, role: 'AUTHOR' };
    adminActor = { id: strangerId, role: 'ADMIN' }; // 타인이지만 ADMIN
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({
      where: { authorId: { in: [ownerId, strangerId] } },
    });
    await prisma.series.deleteMany({
      where: { authorId: { in: [ownerId, strangerId] } },
    });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({
      where: { authorId: { in: [ownerId, strangerId] } },
    });
    await prisma.series.deleteMany({
      where: { authorId: { in: [ownerId, strangerId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, strangerEmail] } },
    });
    await moduleRef?.close();
  });

  it('create: authorId=actor, slug 파생, posts 빈 배열로 반환한다', async () => {
    const dto = await service.create(
      { title: 'React 입문', description: '초보용' },
      ownerActor,
    );
    expect(dto.authorId).toBe(ownerId);
    expect(dto.authorName).toBe('시리즈주인');
    expect(dto.slug).toBe('react-입문');
    expect(dto.description).toBe('초보용');
    expect(dto.posts).toEqual([]);
    expect(dto.postCount).toBe(0);
  });

  it('create: 같은 제목이면 slug 에 -2 suffix 를 부여한다', async () => {
    await service.create({ title: '중복 제목' }, ownerActor);
    const second = await service.create({ title: '중복 제목' }, ownerActor);
    expect(second.slug).toBe('중복-제목-2');
  });

  it('update: 소유자는 title·description 을 바꾸고 slug 는 불변', async () => {
    const created = await service.create({ title: '원제목' }, ownerActor);
    const updated = await service.update(
      created.id,
      { title: '새제목', description: '추가설명' },
      ownerActor,
    );
    expect(updated.title).toBe('새제목');
    expect(updated.description).toBe('추가설명');
    expect(updated.slug).toBe(created.slug); // slug 불변
  });

  it('update: 타인은 403(ForbiddenException)', async () => {
    const created = await service.create({ title: '내것' }, ownerActor);
    await expect(
      service.update(created.id, { title: '침범' }, strangerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update: ADMIN 은 타인 시리즈도 수정 가능', async () => {
    const created = await service.create({ title: '운영대상' }, ownerActor);
    const updated = await service.update(
      created.id,
      { title: '운영수정' },
      adminActor,
    );
    expect(updated.title).toBe('운영수정');
  });

  it('update: 없는 id 는 404(NotFoundException)', async () => {
    await expect(
      service.update('nope', { title: 'x' }, ownerActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove: 소유자 삭제 시 소속 글은 보존되고 seriesId=null', async () => {
    const created = await service.create({ title: '삭제대상' }, ownerActor);
    const post = await prisma.post.create({
      data: {
        slug: `sp-${Date.now()}`,
        title: '소속 글',
        contentMarkdown: 'x',
        authorId: ownerId,
        seriesId: created.id,
        seriesOrder: 0,
      },
    });

    await service.remove(created.id, ownerActor);

    const series = await prisma.series.findUnique({
      where: { id: created.id },
    });
    expect(series).toBeNull();
    const after = await prisma.post.findUnique({ where: { id: post.id } });
    expect(after).not.toBeNull();
    expect(after?.seriesId).toBeNull();
  });

  it('remove: 타인은 403, 없는 id 는 404', async () => {
    const created = await service.create({ title: '보호됨' }, ownerActor);
    await expect(
      service.remove(created.id, strangerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove('nope', ownerActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // --- setPosts (T-SER-003): 멤버십·순서 원자 재지정 ---
  // 발행글 1건 생성 헬퍼(detail.posts 는 발행글만 노출)
  async function makePost(authorId: string, title: string): Promise<string> {
    const p = await prisma.post.create({
      data: {
        slug: `set-${title}-${Date.now()}-${Math.round(performance.now())}`,
        title,
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    return p.id;
  }

  it('setPosts: postIds 순서대로 seriesId·seriesOrder 를 지정한다', async () => {
    const series = await service.create({ title: '연재A' }, ownerActor);
    const a = await makePost(ownerId, 'A');
    const b = await makePost(ownerId, 'B');

    const detail = await service.setPosts(series.id, [b, a], ownerActor);
    // detail.posts 는 seriesOrder 오름차순 → [b, a]
    expect(detail.posts.map((p) => p.id)).toEqual([b, a]);
    expect(detail.postCount).toBe(2);

    const rows = await prisma.post.findMany({
      where: { id: { in: [a, b] } },
      select: { id: true, seriesId: true, seriesOrder: true },
    });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[b].seriesOrder).toBe(0);
    expect(byId[a].seriesOrder).toBe(1);
    expect(byId[a].seriesId).toBe(series.id);
  });

  it('setPosts: 목록에서 빠진 기존 소속 글은 seriesId=null 로 해제(멱등)', async () => {
    const series = await service.create({ title: '연재B' }, ownerActor);
    const a = await makePost(ownerId, 'A');
    const b = await makePost(ownerId, 'B');
    await service.setPosts(series.id, [a, b], ownerActor);

    // b 를 빼고 a 만 재지정
    const detail = await service.setPosts(series.id, [a], ownerActor);
    expect(detail.posts.map((p) => p.id)).toEqual([a]);
    const bRow = await prisma.post.findUnique({
      where: { id: b },
      select: { seriesId: true },
    });
    expect(bRow?.seriesId).toBeNull();
  });

  it('setPosts: 다른 시리즈에 있던 글은 이 시리즈로 이동(한 글 최대 1 시리즈)', async () => {
    const s1 = await service.create({ title: '연재1' }, ownerActor);
    const s2 = await service.create({ title: '연재2' }, ownerActor);
    const a = await makePost(ownerId, 'A');
    await service.setPosts(s1.id, [a], ownerActor);
    await service.setPosts(s2.id, [a], ownerActor); // 이동

    const aRow = await prisma.post.findUnique({
      where: { id: a },
      select: { seriesId: true },
    });
    expect(aRow?.seriesId).toBe(s2.id);
    const s1Detail = await service.setPosts(s1.id, [], ownerActor);
    expect(s1Detail.posts).toEqual([]); // s1 은 비었음
  });

  it('setPosts: AUTHOR 가 타인 글을 포함하면 403(부분 적용 없음)', async () => {
    const series = await service.create({ title: '연재C' }, ownerActor);
    const mine = await makePost(ownerId, 'MINE');
    const theirs = await makePost(strangerId, 'THEIRS');

    await expect(
      service.setPosts(series.id, [mine, theirs], ownerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // 롤백: mine 도 편입되지 않음
    const mineRow = await prisma.post.findUnique({
      where: { id: mine },
      select: { seriesId: true },
    });
    expect(mineRow?.seriesId).toBeNull();
  });

  it('setPosts: ADMIN 은 타인 글도 편입 가능', async () => {
    const series = await service.create({ title: '연재D' }, ownerActor);
    const theirs = await makePost(strangerId, 'THEIRS2');
    const detail = await service.setPosts(series.id, [theirs], adminActor);
    expect(detail.posts.map((p) => p.id)).toEqual([theirs]);
  });

  it('setPosts: 존재하지 않는 postId 는 400(BadRequest)', async () => {
    const series = await service.create({ title: '연재E' }, ownerActor);
    await expect(
      service.setPosts(series.id, ['no-such-post'], ownerActor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setPosts: 시리즈 소유자가 아니면 403, 없는 시리즈는 404', async () => {
    const series = await service.create({ title: '연재F' }, ownerActor);
    const a = await makePost(ownerId, 'A');
    await expect(
      service.setPosts(series.id, [a], strangerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.setPosts('nope', [a], ownerActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  // --- list / getDetail (T-SER-004): 공개 목록·상세(발행글만) ---
  async function makeMember(
    seriesId: string,
    title: string,
    order: number,
    status: 'PUBLISHED' | 'DRAFT',
  ): Promise<string> {
    const p = await prisma.post.create({
      data: {
        slug: `m-${title}-${Date.now()}-${order}`,
        title,
        contentMarkdown: 'x',
        authorId: ownerId,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        seriesId,
        seriesOrder: order,
      },
    });
    return p.id;
  }

  it('list: 페이지네이션 + postCount=발행글 수(초안 제외)', async () => {
    const s = await service.create({ title: '목록 연재' }, ownerActor);
    await makeMember(s.id, 'P1', 0, 'PUBLISHED');
    await makeMember(s.id, 'P2', 1, 'PUBLISHED');
    await makeMember(s.id, 'D1', 2, 'DRAFT'); // 초안 → postCount 제외

    const page = await service.list({ page: 1, pageSize: 20 });
    expect(page.page).toBe(1);
    expect(page.total).toBeGreaterThanOrEqual(1);
    const mine = page.items.find((it) => it.id === s.id);
    expect(mine).toBeDefined();
    expect(mine?.postCount).toBe(2); // 발행 2건만
    expect(mine?.authorName).toBe('시리즈주인');
  });

  it('getDetail: slug·cuid 둘 다, posts 는 발행글만 seriesOrder 오름차순', async () => {
    const s = await service.create({ title: '상세 연재' }, ownerActor);
    await makeMember(s.id, 'B', 1, 'PUBLISHED');
    await makeMember(s.id, 'A', 0, 'PUBLISHED');
    await makeMember(s.id, 'DRAFT', 2, 'DRAFT');

    const bySlug = await service.getDetail(s.slug);
    expect(bySlug.posts.map((p) => p.title)).toEqual(['A', 'B']); // 정렬 + 초안 제외
    expect(bySlug.postCount).toBe(2);

    const byId = await service.getDetail(s.id);
    expect(byId.id).toBe(s.id);
  });

  it('getDetail: 없는 시리즈는 404', async () => {
    await expect(service.getDetail('no-such-series')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getDetail: 발행글 0 이면 빈 posts(초안만 있어도)', async () => {
    const s = await service.create({ title: '빈 연재' }, ownerActor);
    await makeMember(s.id, 'ONLYDRAFT', 0, 'DRAFT');
    const detail = await service.getDetail(s.slug);
    expect(detail.posts).toEqual([]);
    expect(detail.postCount).toBe(0);
  });

  it('list: createdAt 내림차순 정렬 + skip 으로 페이지 분리', async () => {
    const s1 = await service.create({ title: '먼저' }, ownerActor);
    const s2 = await service.create({ title: '나중' }, ownerActor); // 더 최신
    // createdAt 을 명시적으로 분리해 동률(같은 ms) 비결정성을 제거
    await prisma.series.update({
      where: { id: s1.id },
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.series.update({
      where: { id: s2.id },
      data: { createdAt: new Date('2026-01-02T00:00:00Z') },
    });

    // 정렬: 전체 목록에서 s2(최신)가 s1 보다 앞
    const all = await service.list({ page: 1, pageSize: 100 });
    const ids = all.items.map((it) => it.id);
    expect(ids.indexOf(s2.id)).toBeLessThan(ids.indexOf(s1.id));

    // skip: pageSize=1 의 1·2페이지가 서로 다른 항목(총 2건 이상)
    expect(all.total).toBeGreaterThanOrEqual(2);
    const p1 = await service.list({ page: 1, pageSize: 1 });
    const p2 = await service.list({ page: 2, pageSize: 1 });
    expect(p1.items).toHaveLength(1);
    expect(p2.items).toHaveLength(1);
    expect(p1.items[0].id).not.toBe(p2.items[0].id);
  });

  it('list: 범위를 벗어난 페이지는 빈 items + 200(메타 유지)', async () => {
    await service.create({ title: '한 건' }, ownerActor);
    const page = await service.list({ page: 9999, pageSize: 10 });
    expect(page.items).toEqual([]);
    expect(page.page).toBe(9999);
    expect(page.pageSize).toBe(10);
    expect(page.total).toBeGreaterThanOrEqual(1);
  });
});
