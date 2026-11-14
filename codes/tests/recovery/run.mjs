import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";
assert.match(process.env.ACCEPTANCE_DB ?? "", /^HospitalAcceptance_\d+$/);
assert.ok(process.env.ConnectionStrings__Hospital && process.env.DEMO_PASSWORD);
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  API_URL: base,
  WEB_URL: base,
  Web__Origin: base,
  ASPNETCORE_URLS: base,
  Workflow__PrdV2Enabled: "true",
  Demo__Enabled: "true",
  Demo__Password: process.env.DEMO_PASSWORD,
};
const dll = resolve("artifacts/azure-release/Hospital.Api.dll");
const api = spawn("dotnet", [dll, "--no-migrate"], {
  cwd: dirname(dll),
  env,
  stdio: "ignore",
  windowsHide: true,
});
async function run(args) {
  const child = spawn(process.execPath, args, {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, "Recovery acceptance failed");
}
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    assert.equal(api.exitCode, null, "Isolated API exited");
    try {
      ready = (await fetch(base + "/health")).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, "Recovery API readiness");
  await run(["--test", "tests/api/guest-recovery.test.mjs"]);
  await run([
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.recovery.config.ts",
  ]);
} finally {
  api.kill();
  if (api.exitCode === null) await once(api, "exit");
}
