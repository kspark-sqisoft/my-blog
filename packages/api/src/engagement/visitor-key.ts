import { createHash } from 'node:crypto';
import type { Request } from 'express';

// 조회수 dedup 용 방문자키 (ADR-0024).
// 로그인이면 'user:{id}', 비로그인이면 sha256(ip|user-agent) — 원문 IP/UA 는 저장하지 않는다(PII 최소화).
export function visitorKeyFrom(req: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  const ua = req.headers['user-agent'] ?? '';
  return createHash('sha256').update(`${ip}|${ua}`).digest('hex');
}
