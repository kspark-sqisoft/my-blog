import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CommentDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateCommentInput {
  postId: string;
  body: string;
  displayName?: string;
  parentId?: string;
  userId?: string; // 로그인 회원이면 설정 (ADR-0018)
}

// 답글 최대 깊이 (최상위=0, 답글=1, 답글의 답글=2 — ADR-0013)
const MAX_DEPTH = 2;

// 작성자 이름·userId까지 포함해 조회 (ADR-0018)
const withUser = { user: { select: { name: true } } } as const;

type CommentRow = {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string | null;
  displayName: string | null;
  body: string;
  createdAt: Date;
  user: { name: string } | null;
};

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  // Comment 작성. 대상 Post는 발행 상태여야 하며, 깊이 2까지만 허용.
  async create(input: CreateCommentInput): Promise<CommentDto> {
    const post = await this.prisma.post.findFirst({
      where: { id: input.postId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }

    let depth = 0;
    if (input.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: input.parentId },
        select: { id: true, postId: true, parentId: true },
      });
      if (!parent || parent.postId !== input.postId) {
        throw new NotFoundException('상위 댓글을 찾을 수 없습니다.');
      }
      depth = (await this.depthOf(parent.id)) + 1;
      if (depth > MAX_DEPTH) {
        throw new BadRequestException(
          `답글은 깊이 ${MAX_DEPTH}까지만 달 수 있습니다.`,
        );
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId: input.postId,
        body: input.body,
        userId: input.userId ?? null,
        // 로그인 회원은 계정 이름(실명)을 쓰므로 displayName을 저장하지 않는다
        displayName: input.userId ? null : (input.displayName ?? null),
        parentId: input.parentId ?? null,
      },
      include: withUser,
    });
    return this.toDto(comment, depth);
  }

  // 특정 Post의 Comment를 작성순으로 depth 0→1→2 중첩(replies) 구조로 반환
  async listByPost(postId: string): Promise<CommentDto[]> {
    const rows = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: withUser,
    });

    const nodes = new Map<string, CommentDto>();
    for (const row of rows) {
      nodes.set(row.id, this.toDto(row, 0));
    }

    const roots: CommentDto[] = [];
    // createdAt 오름차순이라 부모가 항상 자식보다 먼저 등장
    for (const row of rows) {
      const node = nodes.get(row.id);
      if (!node) continue;
      const parent = row.parentId ? nodes.get(row.parentId) : undefined;
      if (parent) {
        node.depth = parent.depth + 1;
        parent.replies.push(node);
      } else {
        node.depth = 0;
        roots.push(node);
      }
    }
    return roots;
  }

  // 부모 체인을 거슬러 올라가며 깊이(조상 수)를 계산
  private async depthOf(commentId: string): Promise<number> {
    let depth = 0;
    let current: string | null = commentId;
    while (current) {
      const node: { parentId: string | null } | null =
        await this.prisma.comment.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = node?.parentId ?? null;
      if (current) depth++;
      if (depth > MAX_DEPTH + 1) break; // 안전장치
    }
    return depth;
  }

  private toDto(comment: CommentRow, depth: number): CommentDto {
    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      depth,
      userId: comment.userId,
      // 표시 이름: 로그인 회원은 계정 이름(실명), 익명은 displayName
      authorName: comment.user?.name ?? comment.displayName,
      displayName: comment.displayName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      replies: [],
    };
  }
}
