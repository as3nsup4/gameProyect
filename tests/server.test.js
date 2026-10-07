import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAppServer } from '../server.mjs';

test('server serves game modules and rejects private paths and writes', async () => {
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/', '/src/app.js', '/src/game.js', '/styles/main.css', '/styles/responsive.css', '/favicon.svg']) {
      assert.equal((await fetch(base + path)).status, 200, path);
    }
    assert.match(await (await fetch(base)).text(), /Crowd Shift/);
    for (const path of ['/.env', '/.git/config', '/README.md', '/work/hello-publish/.openai/hosting.json', '/src/%2e%2e%2fREADME.md', '/assets/../server.mjs', '/missing']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal((await fetch(base + '/%E0%A4%A')).status, 400);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal(await (await fetch(base, { method: 'HEAD' })).text(), '');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
