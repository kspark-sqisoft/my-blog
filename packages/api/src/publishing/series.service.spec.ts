import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
});
