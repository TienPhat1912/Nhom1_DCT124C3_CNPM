// Own loopback provider and API process; no test hooks or credentials in the product.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";

assert.match(process.env.ACCEPTANCE_DB ?? "", /^HospitalAcceptance_\d+$/);
assert.ok(process.env.ConnectionStrings__Hospital && process.env.DEMO_PASSWORD);
let calls = [],
  fail = false;
const provider = createServer(async (req, res) => {
  if (req.url === "/stats") {
    res.end(JSON.stringify(calls));
    return;
  }
  if (req.url === "/fail" || req.url === "/recover") {
    fail = req.url === "/fail";
    res.end("{}");
    return;
  }
  let body = "";
  for await (const chunk of req) body += chunk;
  const texts = JSON.parse(body);
  calls.push({ url: req.url, texts });
  res.setHeader("Content-Type", "application/json");
  if (fail) {
    res.writeHead(503);
    res.end("{}");
    return;
  }
  res.end(
    JSON.stringify(
      texts.map(({ text }) => ({
        translations: [{ text: "Bản Việt: " + text, to: "vi" }],
      })),
    ),
  );
});
provider.listen(0, "127.0.0.1");
await once(provider, "listening");
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const base = `http://127.0.0.1:${port}`;
const mock = `http://127.0.0.1:${provider.address().port}`;
const dll = resolve(
  process.env.HOSPITAL_DLL ?? "artifacts/azure-release/Hospital.Api.dll",
);
const env = {
  ...process.env,
  API_URL: base,
  WEB_URL: base,
  Web__Origin: base,
  MOCK_TRANSLATION_URL: mock,
  ASPNETCORE_URLS: base,
  Workflow__PrdV2Enabled: "true",
  Translation__Provider: "Azure",
  Translation__Key: "synthetic-only",
  Translation__Endpoint: mock,
  Translation__MaxAttempts: "1",
  Demo__Enabled: "true",
  Demo__Password: process.env.DEMO_PASSWORD,
};
const api = spawn("dotnet", [dll, "--no-migrate"], {
  cwd: dirname(dll),
  env,
  stdio: "ignore",
  windowsHide: true,
});
async function run(command, args, overrides = {}) {
  const child = spawn(command, args, {
    env: { ...env, ...overrides },
    stdio: "inherit",
    windowsHide: true,
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, `${command} failed`);
}
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    assert.equal(api.exitCode, null, "Isolated API exited before readiness");
    try {
      ready = (await fetch(base + "/health")).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, "Isolated API readiness");
  await run(process.execPath, [
    "--test",
    "tests/api/assistance-v2.test.mjs",
  ]);
  await fetch(mock + "/recover");
  await run(process.execPath, [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.assistance.config.ts",
  ]);
} finally {
  api.kill();
  if (api.exitCode === null) await once(api, "exit");
  await new Promise((r) => provider.close(r));
}
