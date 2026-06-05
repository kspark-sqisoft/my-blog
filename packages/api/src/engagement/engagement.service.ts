import { Injectable, NotFoundException } from '@nestjs/common';
import type { LikeStateDto, ViewCountDto } from '@blog/shared';
import { PrismaService } from '../prisma/prisma.service';

// 같은 방문자키의 조회를 중복 집계하지 않는 창(ADR-0024). 30분.
const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;

// 참여(Engagement) 도메인 서비스 (ADR-0024): 좋아요 토글 + 조회수 dedup 집계.
// 카운터(post.likeCount/viewCount)는 진실원천(Like/PostView)과 같은 트랜잭션에서 증감한다.
@Injectable()
export class EngagementService {
  constructor(private readonly prisma: PrismaService) {}

  // 좋아요(멱등). 이미 눌렀으면 증가 없이 현재 상태를 반환한다.
  async like(postId: string, userId: string): Promise<LikeStateDto> {
    const post = await this.requirePublished(postId);
    const existing = await this.prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { postId: true },
    });
    if (existing) {
      return { likeCount: post.likeCount, likedByMe: true };
    }
    const [, updated] = await this.prisma.$transaction([
      this.prisma.like.create({ data: { postId, userId } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      }),
    ]);
    return { likeCount: updated.likeCount, likedByMe: true };
  }

  // 좋아요 취소(멱등). 누른 적 없으면 감소 없이 현재 상태를 반환한다.
  async unlike(postId: string, userId: string): Promise<LikeStateDto> {
    const post = await this.requirePublished(postId);
    const existing = await this.prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { postId: true },
    });
    if (!existing) {
      return { likeCount: post.likeCount, likedByMe: false };
    }
    const [, updated] = await this.prisma.$transaction([
      this.prisma.like.delete({ where: { postId_userId: { postId, userId } } }),
      this.prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      }),
    ]);
    return { likeCount: updated.likeCount, likedByMe: false };
  }

  // 조회 기록(ADR-0024). 같은 방문자키는 30분 창 안에서 1회만 viewCount 증가.
  async recordView(postId: string, visitorKey: string): Promise<ViewCountDto> {
    const post = await this.requirePublished(postId);
    const existing = await this.prisma.postView.findUnique({
      where: { postId_visitorKey: { postId, visitorKey } },
      select: { lastViewedAt: true },
    });
    const now = new Date();
    const isRecent =
      existing &&
      now.getTime() - existing.lastViewedAt.getTime() < VIEW_DEDUP_WINDOW_MS;
    if (isRecent) {
      return { viewCount: post.viewCount };
    }
    const [, updated] = await this.prisma.$transaction([
      this.prisma.postView.upsert({
        where: { postId_visitorKey: { postId, visitorKey } },
        create: { postId, visitorKey, lastViewedAt: now },
        update: { lastViewedAt: now },
      }),
      this.prisma.post.update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } },
        select: { viewCount: true },
      }),
    ]);
    return { viewCount: updated.viewCount };
  }

  // 발행된 글만 참여 대상(초안/없음은 404로 숨김 — 댓글과 동일 정책).
  private async requirePublished(
    postId: string,
  ): Promise<{ id: string; likeCount: number; viewCount: number }> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, status: 'PUBLISHED' },
      select: { id: true, likeCount: true, viewCount: true },
    });
    if (!post) {
      throw new NotFoundException('Post를 찾을 수 없습니다.');
    }
    return post;
  }
}
