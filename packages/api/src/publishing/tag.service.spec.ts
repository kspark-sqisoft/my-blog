import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';
import { PostService } from './post.service';
import { TagService } from './tag.service';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('TagService (통합)', () => {
  let moduleRef: TestingModule;
  let tagService: TagService;
  let postService: PostService;
  let prisma: PrismaService;
  let authorId: string;

  const authorEmail = 'tag-author@example.com';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [PostService, TagService],
    }).compile();
    tagService = moduleRef.get(TagService);
    postService = moduleRef.get(PostService);
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();
    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
    });
    authorId = user.id;
  });

  beforeEach(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
  });

  afterAll(async () => {
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await moduleRef?.close();
  });

  it('Tag 0~5개는 허용된다', () => {
    expect(() => tagService.assertWithinLimit([])).not.toThrow();
    expect(() =>
      tagService.assertWithinLimit(['a', 'b', 'c', 'd', 'e']),
    ).not.toThrow();
  });

  it('Tag 6개 이상은 BadRequestException', () => {
    expect(() =>
      tagService.assertWithinLimit(['a', 'b', 'c', 'd', 'e', 'f']),
    ).toThrow(BadRequestException);
  });

  it('동일 name Tag는 재사용된다(중복 생성 안 함)', async () => {
    await postService.create({
      title: 'p1',
      contentMarkdown: 'x',
      authorId,
      tags: ['shared', 'one'],
    });
    await postService.create({
      title: 'p2',
      contentMarkdown: 'x',
      authorId,
      tags: ['shared', 'two'],
    });
    const count = await prisma.tag.count({ where: { name: 'shared' } });
    expect(count).toBe(1);
  });

  it('Post 수정 시 Tag 집합이 교체된다(추가/제거 반영)', async () => {
    const p = await postService.create({
      title: 'p',
      contentMarkdown: 'x',
      authorId,
      tags: ['a', 'b'],
    });
    const u = await postService.update(p.id, { tags: ['b', 'c'] });
    expect([...u.tags].sort()).toEqual(['b', 'c']);
  });

  it('6개 초과 tag로 create하면 BadRequestException', async () => {
    await expect(
      postService.create({
        title: 'p',
        contentMarkdown: 'x',
        authorId,
        tags: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
