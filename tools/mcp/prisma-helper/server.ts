// prisma-helper — my-blog 전용 MCP 서버(stdio).
// 우리 절대 규칙을 Claude 가 직접 호출할 수 있는 가드 툴로 노출한다:
//  - check_index: 조회 컬럼이 인덱싱돼 있는지(성능)
//  - check_migration_destructive: 마이그레이션이 파괴적인지(데이터 손실 예방)
//  - scan_pii_logging: 로깅에 PII 가 섞였는지(보안)
// 등록: 루트 .mcp.json. 실행: tsx tools/mcp/prisma-helper/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { checkIndex, detectDestructive, scanPiiLogging } from './lib.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const SCHEMA_PATH = resolve(ROOT, 'packages/api/prisma/schema.prisma');
const API_DIR = resolve(ROOT, 'packages/api');
const API_SRC = resolve(API_DIR, 'src');

const json = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

const server = new McpServer({ name: 'prisma-helper', version: '1.0.0' });

server.registerTool(
  'check_index',
  {
    description:
      'schema.prisma 에서 특정 model.column 이 인덱싱(@id/@unique/@@unique/@@index)돼 있는지 점검한다. WHERE/정렬에 쓰는 컬럼의 인덱스 누락을 잡는다.',
    inputSchema: {
      model: z.string().describe("Prisma 모델명 (예: 'Post')"),
      column: z.string().describe("컬럼명 (예: 'authorId')"),
    },
  },
  async ({ model, column }) => {
    const schema = readFileSync(SCHEMA_PATH, 'utf8');
    return json(checkIndex(schema, model, column));
  },
);

server.registerTool(
  'check_migration_destructive',
  {
    description:
      '현재 schema.prisma 와 DB 사이의 마이그레이션 SQL 을 prisma migrate diff 로 생성해 파괴적(DROP/타입변경/NOT NULL 추가) 패턴을 경고한다. 마이그레이션 적용 전에 호출.',
  },
  async () => {
    let sql = '';
    try {
      const res = spawnSync(
        'pnpm',
        [
          '--filter',
          'api',
          'exec',
          'prisma',
          'migrate',
          'diff',
          '--from-schema-datasource',
          'prisma/schema.prisma',
          '--to-schema-datamodel',
          'prisma/schema.prisma',
          '--script',
        ],
        {
          cwd: ROOT,
          encoding: 'utf8',
          timeout: 30000,
          shell: process.platform === 'win32',
        },
      );
      sql = res.stdout || '';
      if (!sql && res.stderr) {
        return json({
          destructive: false,
          warnings: ['prisma migrate diff 실행 불가(DB 연결/CLI 확인)'],
          sqlPreview: res.stderr.slice(0, 300),
        });
      }
    } catch (e) {
      return json({
        destructive: false,
        warnings: [`migrate diff 예외: ${String(e)}`],
        sqlPreview: '',
      });
    }
    const r = detectDestructive(sql);
    return json({ ...r, sqlPreview: sql.slice(0, 500) });
  },
);

server.registerTool(
  'scan_pii_logging',
  {
    description:
      'packages/api/src 의 *.ts(테스트 제외)에서 로깅 호출에 PII 필드(email/password/token 등)가 섞였는지 스캔한다. 커밋/마감 전 보안 점검.',
  },
  async () => {
    const r = scanPiiLogging(API_SRC);
    return json({
      total: r.total,
      violations: r.violations.map((v) => ({
        ...v,
        file: relative(ROOT, v.file).replace(/\\/g, '/'),
      })),
    });
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`prisma-helper 시작 실패: ${String(e)}\n`);
  process.exit(1);
});
