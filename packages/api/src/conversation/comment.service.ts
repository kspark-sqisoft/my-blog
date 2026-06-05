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

// 작성자 이름·아바타·userId까지 포함해 조회 (ADR-0018, ADR-0025)
const withUser = {
  user: { select: { name: true, avatarUrl: true } },
} as const;

type CommentRow = {
  id: string;
  postId: string;
  parentId: string | null;
  userId: string | null;
  displayName: string | null;
  body: string;
  createdAt: Date;
  user: { name: string; avatarUrl: string | null } | null;
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
      // 부모 + 조부모의 parentId 까지 한 번에 select 해서 깊이를 동기 결정한다 (H2).
      // 깊이 2 제한이므로 두 단계 위까지만 알면 충분하다.
      const parent = await this.prisma.comment.findUnique({
        where: { id: input.parentId },
        select: {
          id: true,
          postId: true,
          parentId: true,
          parent: { select: { parentId: true } },
        },
      });
      if (!parent || parent.postId !== input.postId) {
        throw new NotFoundException('상위 댓글을 찾을 수 없습니다.');
      }
      // 부모의 깊이: 최상위(parentId=null)=0, 1단 답글(조부모=null)=1, 그 외=2 이상
      const parentDepth =
        parent.parentId === null
          ? 0
          : (parent.parent?.parentId ?? null) === null
            ? 1
            : 2;
      depth = parentDepth + 1;
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

  private toDto(comment: CommentRow, depth: number): CommentDto {
    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      depth,
      userId: comment.userId,
      // 표시 이름: 로그인 회원은 계정 이름(실명), 익명은 displayName
      authorName: comment.user?.name ?? comment.displayName,
      authorAvatarUrl: comment.user?.avatarUrl ?? null, // 익명·미설정은 null (ADR-0025)
      displayName: comment.displayName,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      replies: [],
    };
  }
}
