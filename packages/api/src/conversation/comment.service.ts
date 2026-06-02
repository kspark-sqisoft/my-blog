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
}

// 답글 최대 깊이 (최상위=0, 답글=1, 답글의 답글=2 — ADR-0013)
const MAX_DEPTH = 2;

type CommentRow = {
  id: string;
  postId: string;
  parentId: string | null;
  displayName: string | null;
  body: string;
  createdAt: Date;
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
        displayName: input.displayName ?? null,
        parentId: input.parentId ?? null,
      },
    });
    return this.toDto(comment, depth);
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
      displayName: comment.displayName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      replies: [],
    };
  }
}
