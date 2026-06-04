// prisma-helper MCP 수동 스모크: 서버를 stdio 로 띄워 핸드셰이크 + 툴 호출을 확인한다.
// 실행: pnpm exec tsx tools/mcp/prisma-helper/smoke.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: 'pnpm',
    args: ['exec', 'tsx', resolve(HERE, 'server.ts')],
    cwd: resolve(HERE, '../../..'),
  });
  const client = new Client({ name: 'smoke', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  console.log('tools:', tools.tools.map((t) => t.name).join(', '));

  const idx = await client.callTool({
    name: 'check_index',
    arguments: { model: 'Comment', column: 'postId' },
  });
  console.log(
    'check_index Comment.postId →',
    (idx.content as { text: string }[])[0].text,
  );

  const pii = await client.callTool({ name: 'scan_pii_logging', arguments: {} });
  console.log(
    'scan_pii_logging →',
    (pii.content as { text: string }[])[0].text,
  );

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
