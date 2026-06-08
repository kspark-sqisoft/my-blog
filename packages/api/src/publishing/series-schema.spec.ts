import { Test, TestingModule } from '@nestjs/testing';
import type {
  CreateSeriesDto,
  SeriesDetailDto,
  SeriesNavDto,
  SeriesSummaryDto,
  SetSeriesPostsDto,
  UpdateSeriesDto,
} from '@blog/shared';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';

// T-SER-001: Series 스키마 + Post 소속/순서 + shared 타입 (ADR-0029)
describe('Series 스키마 (통합, T-SER-001)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let authorId: string;

  const authorEmail = 'ser-schema@example.com';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();
    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
      name: '시리즈저자',
    });
    authorId = user.id;
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.series.deleteMany({ where: { authorId } });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.series.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await moduleRef?.close();
  });

  it('Series 를 생성하고 Post 를 seriesId·seriesOrder 로 소속·정렬한다', async () => {
    const stamp = Date.now();
    const series = await prisma.series.create({
      data: {
        slug: `ser-${stamp}`,
        title: 'React 입문',
        description: '초보용 연재',
        authorId,
      },
    });
    expect(series.id).toBeTruthy();
    expect(series.description).toBe('초보용 연재');

    // 순서를 일부러 뒤섞어 생성해도 seriesOrder 로 정렬됨을 확인
    await prisma.post.create({
      data: {
        slug: `p2-${stamp}`,
        title: '2편',
        contentMarkdown: 'x',
        authorId,
        seriesId: series.id,
        seriesOrder: 1,
      },
    });
    await prisma.post.create({
      data: {
        slug: `p1-${stamp}`,
        title: '1편',
        contentMarkdown: 'x',
        authorId,
        seriesId: series.id,
        seriesOrder: 0,
      },
    });

    const ordered = await prisma.post.findMany({
      where: { seriesId: series.id },
      orderBy: { seriesOrder: 'asc' },
      select: { title: true, seriesOrder: true },
    });
    expect(ordered.map((p) => p.title)).toEqual(['1편', '2편']);
  });

  it('시리즈 미소속 Post 는 seriesId=null, seriesOrder 기본 0', async () => {
    const stamp = Date.now();
    const post = await prisma.post.create({
      data: {
        slug: `solo-${stamp}`,
        title: '독립 글',
        contentMarkdown: 'x',
        authorId,
      },
      select: { seriesId: true, seriesOrder: true },
    });
    expect(post.seriesId).toBeNull();
    expect(post.seriesOrder).toBe(0);
  });

  it('Series 삭제 시 소속 Post 는 보존되고 seriesId=null 로 해제된다(onDelete: SetNull)', async () => {
    const stamp = Date.now();
    const series = await prisma.series.create({
      data: { slug: `del-${stamp}`, title: '삭제될 시리즈', authorId },
    });
    const post = await prisma.post.create({
      data: {
        slug: `dp-${stamp}`,
        title: '소속 글',
        contentMarkdown: 'x',
        authorId,
        seriesId: series.id,
        seriesOrder: 0,
      },
    });

    await prisma.series.delete({ where: { id: series.id } });

    const after = await prisma.post.findUnique({
      where: { id: post.id },
      select: { id: true, seriesId: true },
    });
    expect(after).not.toBeNull(); // 글은 삭제되지 않음
    expect(after?.seriesId).toBeNull(); // 연결만 해제
  });

  it('Series.slug 는 unique 라 중복 생성은 실패한다', async () => {
    const stamp = Date.now();
    const slug = `uniq-${stamp}`;
    await prisma.series.create({ data: { slug, title: 'A', authorId } });
    await expect(
      prisma.series.create({ data: { slug, title: 'B', authorId } }),
    ).rejects.toThrow();
  });

  // shared 순수 타입이 export 되어 사용 가능한지(컴파일 + 런타임 구성) 확인
  it('shared 시리즈 DTO 타입을 구성할 수 있다(순수 타입, zod 미포함)', () => {
    const create: CreateSeriesDto = { title: 'T', description: null };
    const update: UpdateSeriesDto = { title: 'T2' };
    const setPosts: SetSeriesPostsDto = { postIds: ['p1', 'p2'] };
    const summary: SeriesSummaryDto = {
      id: 's1',
      slug: 's-1',
      title: 'T',
      description: null,
      authorId: 'u1',
      authorName: '저자',
      postCount: 0,
    };
    const nav: SeriesNavDto = {
      id: 's1',
      slug: 's-1',
      title: 'T',
      position: 1,
      total: 1,
      prev: null,
      next: null,
    };
    const detail: SeriesDetailDto = { ...summary, posts: [] };
    expect(create.title).toBe('T');
    expect(update.title).toBe('T2');
    expect(setPosts.postIds).toHaveLength(2);
    expect(nav.total).toBe(1);
    expect(detail.posts).toHaveLength(0);
  });
});
