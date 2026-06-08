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
});
