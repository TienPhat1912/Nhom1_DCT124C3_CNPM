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
  ASPNETCORE_URLS: base,
  Web__Origin: base,
  Demo__Enabled: "true",
  Demo__Password: process.env.DEMO_PASSWORD,
};
const dll = resolve("artifacts/azure-release/Hospital.Api.dll");
const api = spawn("dotnet", [dll, "--no-migrate"], {
  cwd: dirname(dll),
  env,
  windowsHide: true,
  stdio: "ignore",
});
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    assert.equal(api.exitCode, null, "Presence API exited");
    try {
      ready = (await fetch(base + "/health")).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, "Presence API readiness");
  const child = spawn(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.presence.config.ts",
    ],
    { env, stdio: "inherit", windowsHide: true },
  );
  const [code] = await once(child, "exit");
  assert.equal(code, 0, "Presence client acceptance failed");
} finally {
  api.kill();
  if (api.exitCode === null) await once(api, "exit");
}
