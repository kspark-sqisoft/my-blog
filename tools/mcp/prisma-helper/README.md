# prisma-helper — my-blog 전용 MCP 서버

우리 절대 규칙을 Claude 가 직접 호출할 수 있는 **가드 툴**로 노출하는 로컬 MCP(stdio) 서버. (가이드 8.5)
TypeScript(rule #1) + `@modelcontextprotocol/sdk` + `tsx` 로 구현. 별도 빌드 불필요.

## 툴

| 툴 | 입력 | 하는 일 | 받쳐주는 규칙 |
|---|---|---|---|
| `check_index` | `model`, `column` | schema.prisma 에서 컬럼이 인덱싱(@id/@unique/@@unique/@@index)됐는지 | 조회 성능(N+1·풀스캔 예방) |
| `check_migration_destructive` | (없음) | `prisma migrate diff` SQL 에서 DROP/타입변경/NOT NULL 추가 탐지 | 데이터 손실 예방 |
| `scan_pii_logging` | (없음) | `packages/api/src` 로깅에 PII(email/password/token 등) 섞였는지 | 보안(PII 로깅 금지) |

## 등록 / 실행

- 등록: 루트 `.mcp.json`(project scope). Claude Code 에서 `/mcp` 로 `prisma-helper` 연결 확인.
- 핵심 로직은 순수 함수(`lib.ts`)로 분리해 단위 테스트한다.

```bash
pnpm mcp:test    # 순수 로직 단위 테스트(node:test via tsx)
pnpm mcp:smoke   # 서버 stdio 기동 + 핸드셰이크 + 툴 호출 스모크
```

## 구조
- `lib.ts` — 순수 로직(checkIndex / detectDestructive / scanPiiLogging). DB·전송 비의존.
- `lib.test.ts` — 단위 테스트(9 케이스).
- `server.ts` — MCP 서버 wiring(stdio). 위 함수를 3개 툴로 등록.
- `smoke.ts` — MCP 클라이언트로 서버를 띄워 end-to-end 확인.

## 주의
- stdout 은 JSON-RPC 전용 — 서버에서 `console.log` 금지(로그는 stderr).
- `check_migration_destructive` 는 DB 연결(DATABASE_URL)이 필요하며, 불가 시 경고 메시지로 graceful 반환.
