#!/usr/bin/env bun
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import process from 'node:process';

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryFetch = () => {
      fetch(url)
        .then((res) => {
          if (res.ok) resolve();
          else throw new Error('not ready');
        })
        .catch(() => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`));
            return;
          }
          setTimeout(tryFetch, 200);
        });
    };
    tryFetch();
  });
}

function runBuild() {
  return new Promise((resolve) => {
    const child = spawn('bun', ['run', 'build'], { stdio: 'inherit', env: process.env });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function runPlaywright(port, extraArgs) {
  const baseUrl = `http://localhost:${port}`;
  return new Promise((resolve) => {
    const child = spawn('bun', ['x', 'playwright', 'test', ...extraArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEPUQ_E2E_PORT: String(port),
        PLAYWRIGHT_BASE_URL: baseUrl,
        TEPUQ_E2E_NO_WEBSERVER: 'true',
      },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const requestedPort = Number(process.env.TEPUQ_E2E_PORT);
  const port = Number.isFinite(requestedPort) && requestedPort > 0
    ? requestedPort
    : await findFreePort();
  const baseUrl = `http://localhost:${port}`;

  console.log(`[e2e] using port ${port}`);

  if (!existsSync('dist')) {
    console.log('[e2e] dist/ not found, running build first');
    const buildCode = await runBuild();
    if (buildCode !== 0) {
      console.error('[e2e] build failed');
      process.exit(buildCode);
    }
  }

  // Start the preview server ourselves so we hold the port and avoid races
  // with other agents or with a separate `bun run preview` on the default port.
  const preview = spawn('bun', ['run', 'preview', '--port', String(port)], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  });

  let exitCode = 1;
  try {
    await waitForServer(baseUrl);
    console.log(`[e2e] preview ready at ${baseUrl}, running tests`);
    exitCode = await runPlaywright(port, process.argv.slice(2));
  } catch (err) {
    console.error('[e2e] error:', err.message);
  } finally {
    preview.kill('SIGTERM');
    setTimeout(() => preview.kill('SIGKILL'), 5000).unref();
  }

  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
