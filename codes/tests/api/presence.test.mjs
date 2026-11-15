import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.API_URL,
  password = process.env.DEMO_PASSWORD;
assert.match(process.env.ACCEPTANCE_DB ?? "", /^HospitalAcceptance_\d+$/);
async function call(token, path, body, expected = 200) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      "Idempotency-Key": randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${path}: ${data.title ?? ""}`);
  return data;
}
const beat = (token) => call(token, "/api/v2/presence/heartbeat", {});
async function login(role) {
  return call(null, "/api/auth/login", {
    email: `${role}@demo.local`,
    password,
  });
}
test("presence uses server identity, deduplicates Accounts and removes logout/revoked/expired sessions", async () => {
  const admin = await login("admin");
  const reception = await login("reception");
  const dashboard = () => call(admin.token, "/api/admin/dashboard?days=7");
  const initial = await dashboard();
  assert.equal(
    initial.online.total,
    0,
    "Existing unexpired sessions are not online without heartbeats",
  );
  const email = `${randomUUID()}@example.test`;
  const first = await call(null, "/api/auth/register", {
    email,
    password,
    name: "Same Name",
    contact: "same-contact",
    language: "en",
  });
  const second = await call(null, "/api/auth/login", { email, password });
  const guest = await call(null, "/api/auth/guest", { language: "en" });
  await call(null, "/api/v2/presence/heartbeat", {}, 401);
  await call(
    guest.token,
    "/api/v2/presence/heartbeat",
    {
      userId: admin.sessionId,
      role: "Admin",
      lastSeenAt: "2099-01-01T00:00:00Z",
    },
    422,
  );
  for (const [contentType, body, status] of [
    ["application/json", "{", 422],
    ["text/plain", "{}", 415],
  ]) {
    const rejected = await fetch(base + "/api/v2/presence/heartbeat", {
      method: "POST",
      headers: {
        "X-Hospital-Client": "1",
        "Content-Type": contentType,
        Authorization: `Bearer ${guest.token}`,
      },
      body,
    });
    assert.equal(
      rejected.status,
      status,
      "Invalid heartbeat body is rejected without recording presence",
    );
  }
  await call(guest.token, "/api/admin/dashboard", undefined, 403);
  await call(first.token, "/api/admin/dashboard", undefined, 403);
  await call(reception.token, "/api/admin/dashboard", undefined, 403);
  const response = await beat(first.token);
  assert.equal(response.heartbeatSeconds, 15);
  assert.equal(response.ttlSeconds, 60);
  assert.ok(Date.parse(response.lastSeenAt));
  assert.ok(
    response.lastSeenAt.endsWith("Z"),
    "Heartbeat timestamp is unambiguously UTC",
  );
  await beat(second.token);
  await beat(guest.token);
  const noBody = await fetch(base + "/api/v2/presence/heartbeat", {
    method: "POST",
    headers: {
      "X-Hospital-Client": "1",
      Authorization: `Bearer ${guest.token}`,
    },
  });
  assert.equal(
    noBody.status,
    200,
    "V2 contract accepts heartbeat without body, version or idempotency key",
  );
  const withoutKey = await fetch(base + "/api/presence/heartbeat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      Authorization: `Bearer ${guest.token}`,
    },
    body: "{}",
  });
  assert.equal(
    withoutKey.status,
    200,
    "Presence is independent of business command idempotency keys",
  );
  const active = await dashboard();
  const dedicated = await call(admin.token, "/api/v2/admin/presence");
  assert.deepEqual(
    [dedicated.accounts, dedicated.guests, dedicated.total],
    [1, 1, 2],
  );
  await call(guest.token, "/api/v2/admin/presence", undefined, 403);
  await call(reception.token, "/api/v2/admin/presence", undefined, 403);
  await call(null, "/api/v2/admin/presence", undefined, 401);
  assert.deepEqual(
    [active.online.accounts, active.online.guests, active.online.total],
    [1, 1, 2],
  );
  assert.equal(active.online.generatedAt, active.generatedAt);
  for (const key of ["summary", "daily", "departments", "configuration"])
    assert.deepEqual(active[key], initial[key], `Preserve Dashboard ${key}`);
  await call(first.token, "/api/auth/logout", {});
  assert.equal((await dashboard()).online.accounts, 1);
  fixtureSql(`UPDATE Sessions SET Revoked=1 WHERE Id='${second.sessionId}';`);
  await call(second.token, "/api/v2/presence/heartbeat", {}, 401);
  assert.equal((await dashboard()).online.accounts, 0);
  await call(guest.token, "/api/auth/logout", {});
  assert.equal((await dashboard()).online.guests, 0);
  const expired = await call(null, "/api/auth/guest", { language: "en" });
  await beat(expired.token);
  fixtureSql(
    `UPDATE Sessions SET ExpiresAt=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id='${expired.sessionId}';`,
  );
  await call(expired.token, "/api/v2/presence/heartbeat", {}, 401);
  assert.equal((await dashboard()).online.total, 0);
});

test("20 concurrent clients can heartbeat while business commands remain responsive", async () => {
  const users = [];
  for (let i = 0; i < 20; i++)
    users.push(await call(null, "/api/auth/guest", { language: "en" }));
  async function timed(action) {
    const start = performance.now();
    await action();
    return performance.now() - start;
  }
  const help = (token) =>
    call(token, "/api/assistance", {
      category: "Navigation",
      description: "Synthetic PB028 load",
      sourceLanguage: "en",
      visitId: null,
      requestId: null,
      stepId: null,
    });
  const baseline = await Promise.all(
    users.map((user) => timed(() => help(user.token))),
  );
  const heartbeats = [],
    business = [];
  await Promise.all(
    users.flatMap((user) => [
      (async () => {
        for (let i = 0; i < 5; i++)
          heartbeats.push(await timed(() => beat(user.token)));
      })(),
      (async () => {
        business.push(await timed(() => help(user.token)));
      })(),
    ]),
  );
  const stats = (values) => {
    const sorted = values.toSorted((a, b) => a - b);
    return {
      count: values.length,
      p95Ms:
        Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1] * 100) / 100,
      maxMs: Math.round(sorted.at(-1) * 100) / 100,
    };
  };
  const result = {
    concurrentClients: 20,
    baseline: stats(baseline),
    businessWithHeartbeats: stats(business),
    heartbeat: stats(heartbeats),
    criterion: "Business commands p95 <= 2000 ms; zero failed requests",
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/pb028-performance.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  assert.ok(
    result.businessWithHeartbeats.p95Ms <= 2000,
    "Heartbeat must not stall business commands",
  );
});
