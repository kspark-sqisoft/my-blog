import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';
import { PostService } from './post.service';
import { TagService } from './tag.service';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('PostService (통합)', () => {
  let moduleRef: TestingModule;
  let service: PostService;
  let prisma: PrismaService;
  let authorId: string;

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

  it('create 시 status=DRAFT, authorId가 설정된 Post를 반환한다', async () => {
    const post = await service.create({
      title: '첫 글',
      contentMarkdown: '# 본문',
      authorId,
      tags: ['nestjs', 'ddd'],
    });
    expect(post.status).toBe('DRAFT');
    expect(post.authorId).toBe(authorId);
    expect(post.title).toBe('첫 글');
    expect(post.publishedAt).toBeNull();
    expect([...post.tags].sort()).toEqual(['ddd', 'nestjs']);
  });

  it('update는 title/contentMarkdown/tags 부분 수정을 반영한다', async () => {
    const created = await service.create({
      title: '원본',
      contentMarkdown: '원본 본문',
      authorId,
      tags: ['a'],
    });
    const updated = await service.update(created.id, {
      title: '수정됨',
      contentMarkdown: '수정 본문',
      tags: ['b', 'c'],
    });
    expect(updated.title).toBe('수정됨');
    expect(updated.contentMarkdown).toBe('수정 본문');
    expect([...updated.tags].sort()).toEqual(['b', 'c']);
  });

  it('존재하지 않는 id update → NotFoundException', async () => {
    await expect(
      service.update('no-such-id', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('존재하지 않는 id remove → NotFoundException', async () => {
    await expect(service.remove('no-such-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove는 Post를 삭제한다', async () => {
    const created = await service.create({
      title: '삭제 대상',
      contentMarkdown: 'x',
      authorId,
    });
    await service.remove(created.id);
    const found = await prisma.post.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it('publish → status=PUBLISHED, publishedAt 설정', async () => {
    const created = await service.create({
      title: '발행할 글',
      contentMarkdown: 'x',
      authorId,
    });
    const published = await service.publish(created.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();
  });

  it('unpublish → status=DRAFT, publishedAt 정리', async () => {
    const created = await service.create({
      title: '토글',
      contentMarkdown: 'x',
      authorId,
    });
    await service.publish(created.id);
    const draft = await service.unpublish(created.id);
    expect(draft.status).toBe('DRAFT');
    expect(draft.publishedAt).toBeNull();
  });

  it('이미 발행된 글을 다시 publish해도 publishedAt이 유지된다(멱등)', async () => {
    const created = await service.create({
      title: '멱등',
      contentMarkdown: 'x',
      authorId,
    });
    const first = await service.publish(created.id);
    const second = await service.publish(created.id);
    expect(second.status).toBe('PUBLISHED');
    expect(second.publishedAt).toBe(first.publishedAt);
  });

  it('초안을 unpublish해도 안전하게 DRAFT를 유지한다', async () => {
    const created = await service.create({
      title: '초안',
      contentMarkdown: 'x',
      authorId,
    });
    const res = await service.unpublish(created.id);
    expect(res.status).toBe('DRAFT');
  });

  it('없는 id publish/unpublish → NotFoundException', async () => {
    await expect(service.publish('no-such-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.unpublish('no-such-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
