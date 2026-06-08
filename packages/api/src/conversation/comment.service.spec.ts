import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedOperator } from '../auth/seed-operator';
import { CommentService } from './comment.service';

process.env.DATABASE_URL ??=
  'postgresql://blog:blog@localhost:5433/blog?schema=public';

describe('CommentService (통합)', () => {
  let moduleRef: TestingModule;
  let service: CommentService;
  let prisma: PrismaService;
  let authorId: string;
  let publishedId: string;
  let draftId: string;

  const authorEmail = 'comment-author@example.com';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [CommentService],
    }).compile();
    service = moduleRef.get(CommentService);
    prisma = moduleRef.get(PrismaService);
    await moduleRef.init();

    const user = await seedOperator(prisma, {
      email: authorEmail,
      password: 'x',
    });
    authorId = user.id;
    const published = await prisma.post.create({
      data: {
        slug: `pub-${Date.now()}`,
        title: 'pub',
        contentMarkdown: 'x',
        authorId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    publishedId = published.id;
    const draft = await prisma.post.create({
      data: {
        slug: `draft-${Date.now()}`,
        title: 'draft',
        contentMarkdown: 'x',
        authorId,
      },
    });
    draftId = draft.id;
  });

  beforeEach(async () => {
    await prisma.comment.deleteMany({ where: { post: { authorId } } });
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { post: { authorId } } });
    await prisma.post.deleteMany({ where: { authorId } });
    await prisma.user.deleteMany({ where: { email: authorEmail } });
    await moduleRef?.close();
  });

  it('최상위 Comment(depth 0)와 답글(depth 1)을 작성할 수 있다', async () => {
    const top = await service.create({ postId: publishedId, body: '최상위' });
    expect(top.parentId).toBeNull();
    expect(top.depth).toBe(0);

    const reply = await service.create({
      postId: publishedId,
      body: '답글',
      parentId: top.id,
    });
    expect(reply.parentId).toBe(top.id);
    expect(reply.depth).toBe(1);
  });

  it('로그인 회원 댓글은 userId 연결 + 계정 이름(실명), displayName 무시 (ADR-0018)', async () => {
    const user = await prisma.user.findUnique({ where: { id: authorId } });
    const c = await service.create({
      postId: publishedId,
      body: '회원 댓글',
      userId: authorId,
      displayName: '무시될-이름',
    });
    expect(c.userId).toBe(authorId);
    expect(c.authorName).toBe(user?.name);
    expect(c.displayName).toBeNull();
  });

  it('비로그인 댓글은 익명(displayName)이고 userId는 null (ADR-0018)', async () => {
    const c = await service.create({
      postId: publishedId,
      body: '익명 댓글',
      displayName: '익명이',
    });
    expect(c.userId).toBeNull();
    expect(c.authorName).toBe('익명이');
    expect(c.displayName).toBe('익명이');
  });

  it('깊이 2까지 허용하고 깊이 3은 BadRequestException', async () => {
    const top = await service.create({ postId: publishedId, body: 't' });
    const r1 = await service.create({
      postId: publishedId,
      body: 'r1',
      parentId: top.id,
    });
    const r2 = await service.create({
      postId: publishedId,
      body: 'r2',
      parentId: r1.id,
    });
    expect(r2.depth).toBe(2);

    await expect(
      service.create({ postId: publishedId, body: 'r3', parentId: r2.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('미발행 Post에는 작성할 수 없다(NotFound)', async () => {
    await expect(
      service.create({ postId: draftId, body: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('없는 Post에는 작성할 수 없다(NotFound)', async () => {
    await expect(
      service.create({ postId: 'no-such', body: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listByPost는 작성순으로 depth 0→1→2 중첩 구조를 반환한다', async () => {
    const top = await service.create({ postId: publishedId, body: 'top' });
    const r1 = await service.create({
      postId: publishedId,
      body: 'r1',
      parentId: top.id,
    });
    await service.create({ postId: publishedId, body: 'r2', parentId: r1.id });
    const top2 = await service.create({ postId: publishedId, body: 'top2' });

    const tree = await service.listByPost(publishedId);

    expect(tree.map((c) => c.id)).toEqual([top.id, top2.id]);
    expect(tree[0].depth).toBe(0);

    expect(tree[0].replies).toHaveLength(1);
    const reply1 = tree[0].replies[0];
    expect(reply1.body).toBe('r1');
    expect(reply1.depth).toBe(1);
    expect(reply1.replies).toHaveLength(1);
    const reply2 = reply1.replies[0];
    expect(reply2.body).toBe('r2');
    expect(reply2.depth).toBe(2);
    expect(reply2.replies).toEqual([]);

    expect(tree[1].id).toBe(top2.id);
    expect(tree[1].replies).toEqual([]);
  });

  it('listByPost는 댓글이 없으면 빈 배열을 반환한다', async () => {
    const tree = await service.listByPost(publishedId);
    expect(tree).toEqual([]);
  });

  // T-CONV-006: 수정 (로그인 작성자 본인만)
  describe('update (수정 — 본인만)', () => {
    it('본인은 body 수정 + isEdited/editedAt 설정', async () => {
      const c = await service.create({
        postId: publishedId,
        body: '원본',
        userId: authorId,
      });
      const updated = await service.update(c.id, '수정됨', {
        id: authorId,
        role: 'ADMIN',
      });
      expect(updated.body).toBe('수정됨');
      expect(updated.isEdited).toBe(true);
      expect(updated.editedAt).not.toBeNull();
      expect(updated.parentId).toBe(c.parentId); // 깊이·parentId 불변
    });

    it('타인 수정은 ForbiddenException(403)', async () => {
      const c = await service.create({
        postId: publishedId,
        body: 'x',
        userId: authorId,
      });
      await expect(
        service.update(c.id, 'y', { id: 'other-user', role: 'MEMBER' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('익명 댓글은 본인이 성립하지 않아 Forbidden(403)', async () => {
      const c = await service.create({
        postId: publishedId,
        body: '익명',
        displayName: '익',
      });
      await expect(
        service.update(c.id, 'y', { id: authorId, role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('없는 댓글은 NotFoundException(404)', async () => {
      await expect(
        service.update('no-such', 'y', { id: authorId, role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // T-CONV-006: 소프트 삭제 노드는 toDto 에서 본문·작성자를 가린다(M6)
  describe('toDto 소프트 삭제 가림', () => {
    it('deletedAt 있으면 body/authorName/avatar/displayName 가림 + isDeleted', async () => {
      const c = await service.create({
        postId: publishedId,
        body: '삭제될 댓글',
        userId: authorId,
      });
      await prisma.comment.update({
        where: { id: c.id },
        data: { deletedAt: new Date() },
      });
      const tree = await service.listByPost(publishedId);
      const node = tree.find((n) => n.id === c.id);
      expect(node?.isDeleted).toBe(true);
      expect(node?.body).toBe('');
      expect(node?.authorName).toBeNull();
      expect(node?.authorAvatarUrl).toBeNull();
      expect(node?.displayName).toBeNull();
    });
  });

  // T-CONV-007: 삭제 (조건부 soft/hard) + 권한
  describe('remove (삭제 — 조건부 soft/hard)', () => {
    it('직계 답글이 없으면 hard delete(노드 소멸)', async () => {
      const c = await service.create({
        postId: publishedId,
        body: '잎 댓글',
        userId: authorId,
      });
      await service.remove(c.id, { id: authorId, role: 'ADMIN' });
      const tree = await service.listByPost(publishedId);
      expect(tree.find((n) => n.id === c.id)).toBeUndefined();
    });

    it('직계 답글이 있으면 soft(deletedAt, 노드·답글 보존)', async () => {
      const top = await service.create({
        postId: publishedId,
        body: 'top',
        userId: authorId,
      });
      await service.create({
        postId: publishedId,
        body: 'reply',
        parentId: top.id,
        userId: authorId,
      });
      await service.remove(top.id, { id: authorId, role: 'ADMIN' });
      const tree = await service.listByPost(publishedId);
      const node = tree.find((n) => n.id === top.id);
      expect(node?.isDeleted).toBe(true);
      expect(node?.body).toBe('');
      expect(node?.replies).toHaveLength(1);
    });

    it('본인·ADMIN·글쓴이가 아니면 ForbiddenException(403)', async () => {
      const c = await service.create({
        postId: publishedId,
        body: 'x',
        userId: authorId,
      });
      await expect(
        service.remove(c.id, { id: 'other-user', role: 'MEMBER' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('글쓴이는 타인(익명 포함) 댓글도 삭제 가능 (post.authorId 조회 1회 — N+1 없음)', async () => {
      const c = await service.create({
        postId: publishedId,
        body: '익명 댓글',
        displayName: '익',
      });
      // authorId = 대상 Post 의 글쓴이 → 익명 댓글 삭제(잎이라 hard).
      // 글쓴이 권한 판정은 post.findUnique(select authorId) 를 정확히 1회만 호출한다(read-only).
      const spy = jest.spyOn(prisma.post, 'findUnique');
      await service.remove(c.id, { id: authorId, role: 'AUTHOR' });
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
      const tree = await service.listByPost(publishedId);
      expect(tree.find((n) => n.id === c.id)).toBeUndefined();
    });

    it('없는 댓글은 NotFoundException(404)', async () => {
      await expect(
        service.remove('no-such', { id: authorId, role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // T-CONV-007: 소프트 삭제된 부모에는 답글을 달 수 없다(S2)
  describe('create — 소프트 삭제 부모 답글 차단', () => {
    it('soft 삭제된 부모에 답글 작성 → BadRequestException(400)', async () => {
      const top = await service.create({
        postId: publishedId,
        body: 'top',
        userId: authorId,
      });
      await service.create({
        postId: publishedId,
        body: 'r',
        parentId: top.id,
        userId: authorId,
      });
      await service.remove(top.id, { id: authorId, role: 'ADMIN' }); // 답글有 → soft
      await expect(
        service.create({
          postId: publishedId,
          body: '새 답글',
          parentId: top.id,
          userId: authorId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
