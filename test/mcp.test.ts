import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('MCP server starts and exposes bounded read-only replay tools', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('dist/src/mcp.js')],
    cwd: process.cwd(),
    stderr: 'pipe',
  });
  const client = new Client({ name: 'sudokupad-replay-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ['get_state', 'inspect_replay', 'query_events']);
    const response = await client.callTool({
      name: 'inspect_replay',
      arguments: { path: resolve('test/fixtures/synthetic-basic.replay') },
    });
    assert.equal(response.isError, undefined);
    const structured = response.structuredContent as { actionCount: number; metadata: { format: string } };
    assert.equal(structured.actionCount, 15);
    assert.equal(structured.metadata.format, 'replay_v1.0');
  } finally {
    await client.close();
  }
});
