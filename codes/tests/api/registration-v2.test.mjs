import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";

const base = process.env.API_URL;
const password = process.env.DEMO_PASSWORD;
assert.ok(
  base && password,
  "Use an explicitly configured isolated acceptance API",
);
let config, reception;
async function call(
  token,
  path,
  body,
  expected = 200,
  key = randomUUID(),
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Hospital-Client": "1",
      "X-Client": "native",
      "Idempotency-Key": key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${path}: ${result.title ?? ""}`);
  return result;
}
const input = {
  contact: "synthetic-contact",
  preferredDepartmentId: null,
  description: "  原文\nSynthetic description  ",
  sourceLanguage: "zh",
};
async function patient(guest = false) {
  if (!guest) {
    const email = `${randomUUID()}@example.test`;
    return {
      ...(await call(null, "/api/auth/register", {
        email,
        password,
        name: "PB006 fixture",
        contact: input.contact,
        language: "en",
      })),
      email,
    };
  }
  const session = await call(null, "/api/auth/guest", { language: "en" });
  await call(
    session.token,
    "/api/auth/profile",
    { name: "PB006 Guest", contact: input.contact, language: "en", version: 1 },
    200,
    randomUUID(),
    "PUT",
  );
  return session;
}
before(async () => {
  config = await call(null, "/api/config");
  reception = await call(null, "/api/auth/login", {
    email: "reception@demo.local",
    password,
  });
});

test("disabled V2 workflow rejects requests and stays absent from configuration", async () => {
  assert.equal(config.prdV2Enabled, false);
  assert.equal(
    (await call(null, "/api/v2/requests", {}, 503)).title,
    "workflowNotEnabled",
  );
});

for (const guest of [false, true]) {
  test(`concurrent ${guest ? "Guest" : "Account"} submissions create one pending request and replay one receipt`, async () => {
    const session = await patient(guest);
    const requests = await Promise.all(
      Array.from({ length: 10 }, async () => {
        const r = await fetch(base + "/api/v2/requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Hospital-Client": "1",
            Authorization: `Bearer ${session.token}`,
            "Idempotency-Key": randomUUID(),
          },
          body: JSON.stringify(input),
        });
        return { status: r.status, body: await r.json() };
      }),
    );
    assert.equal(requests.filter((r) => r.status === 201).length, 1);
    const id = requests.find((r) => r.status === 201).body.id;
    for (const r of requests.filter((r) => r.status !== 201)) {
      assert.equal(r.status, 409);
      assert.equal(r.body.title, "pendingRequestExists");
      assert.equal(r.body.existingRequestId, id);
    }
    assert.equal((await call(session.token, "/api/v2/requests")).length, 1);
    if (!guest) {
      const anotherSession = await call(null, "/api/auth/login", {
        email: session.email,
        password,
        language: "en",
      });
      assert.notEqual(anotherSession.sessionId, session.sessionId);
      assert.equal(
        (await call(anotherSession.token, "/api/v2/requests", input, 409))
          .existingRequestId,
        id,
      );
    }
    const other = await patient(guest),
      key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        call(other.token, "/api/v2/requests", input, 201, key),
      ),
    );
    assert.equal(new Set(results.map((r) => r.id)).size, 1);
    assert.equal(
      (
        await call(
          other.token,
          "/api/v2/requests",
          { ...input, description: "Changed" },
          409,
          key,
        )
      ).title,
      "idempotencyConflict",
    );
    assert.match(
      fixtureSql(
        `SET NOCOUNT ON; SELECT COUNT(*) FROM CommandReceipt WHERE [Key]='${key}';`,
      ),
      /\b1\b/,
    );
  });
}

test("original text, source language and routing survive reads without translation or privilege injection", async () => {
  const session = await patient();
  const lab = config.departments.find((d) => d.code === "LAB");
  const result = await call(
    session.token,
    "/api/v2/requests",
    { ...input, preferredDepartmentId: lab.id },
    201,
  );
  assert.equal(result.contractVersion, "prd-v2");
  assert.equal(result.description, input.description);
  assert.equal(
    result.departmentId,
    config.departments.find((d) => d.code === "CONSULT").id,
  );
  assert.equal(result.preferredDepartmentId, lab.id);
  assert.equal(result.canConfirm, false);
  const read = await call(
    session.token,
    `/api/v2/requests/${result.id}?language=ja`,
  );
  assert.equal(read.description, input.description);
  assert.equal(read.sourceLanguage, "zh");
  const other = await patient();
  await call(other.token, `/api/v2/requests/${result.id}`, undefined, 403);
  await call(null, `/api/v2/requests/${result.id}`, undefined, 401);
  await call(null, "/api/v2/requests", input, 401);
  await call(reception.token, "/api/v2/requests", input, 403);
  assert.equal(
    (await call(reception.token, `/api/v2/requests/${result.id}`)).description,
    input.description,
  );
  const email = `scope-${randomUUID()}@example.test`;
  fixtureSql(`INSERT INTO Users (Id,Version,CreatedAt,Email,PasswordHash,Name,Role,PatientId,Active)
    SELECT NEWID(),1,SYSUTCDATETIME(),'${email}',PasswordHash,'Synthetic Reception','Reception',NULL,1 FROM Users WHERE Email='doctor@demo.local';`);
  const wrongScope = await call(null, "/api/auth/login", { email, password });
  await call(wrongScope.token, `/api/v2/requests/${result.id}`, undefined, 403);
  const profile = await call(session.token, "/api/auth/profile");
  await call(
    session.token,
    "/api/auth/profile",
    {
      name: profile.name,
      contact: profile.contact,
      language: "ja",
      version: profile.version,
    },
    200,
    randomUUID(),
    "PUT",
  );
  assert.equal(
    (await call(session.token, `/api/v2/requests/${result.id}`)).sourceLanguage,
    "zh",
  );
  await call(
    reception.token,
    `/api/requests/${result.id}/confirm`,
    {
      version: 1,
      departmentId: result.departmentId,
      locationId: config.locations.find((l) => l.room === "A101").id,
      attendeeVerified: true,
      verificationNote: "Must remain blocked",
    },
    410,
  );
  await call(
    session.token,
    "/api/requests",
    {
      name: "Legacy bypass",
      contact: input.contact,
      description: "",
      requests: "",
      departmentId: result.departmentId,
    },
    409,
  );
});

test("another Guest session for the same Patient cannot discover pending or active record IDs", async () => {
  const original = await patient(true);
  await call(original.token, "/api/v2/requests", input, 201);
  const token = randomUUID(),
    hash = createHash("sha256").update(token).digest("hex").toUpperCase();
  fixtureSql(`INSERT INTO Sessions (Id,Version,CreatedAt,PatientId,UserAccountId,TokenHash,IsGuest,ExpiresAt,Revoked)
    VALUES (NEWID(),1,SYSUTCDATETIME(),'${original.patientId}',NULL,'${hash}',1,DATEADD(hour,1,SYSUTCDATETIME()),0);`);
  const conflict = await call(token, "/api/v2/requests", input, 409);
  assert.equal(conflict.title, "pendingRequestExists");
  assert.equal(conflict.existingRequestId, null);
  assert.deepEqual(await call(token, "/api/v2/requests"), []);
});

test("validation rejects unknown/forged fields and invalid source or preferences", async () => {
  const session = await patient();
  for (const extra of [
    "patientId",
    "name",
    "departmentId",
    "actorId",
    "status",
    "capabilities",
  ])
    await call(
      session.token,
      "/api/v2/requests",
      { ...input, [extra]: randomUUID() },
      422,
    );
  for (const invalid of [
    { sourceLanguage: "ko" },
    { description: null },
    { description: "x".repeat(2001) },
    { preferredDepartmentId: "bad-guid" },
    { preferredDepartmentId: randomUUID() },
    { contact: "x" },
  ])
    await call(
      session.token,
      "/api/v2/requests",
      { ...input, ...invalid },
      422,
    );
  assert.deepEqual(await call(session.token, "/api/v2/requests"), []);
  assert.equal(
    (
      await call(
        session.token,
        "/api/v2/requests",
        { ...input, description: "" },
        201,
      )
    ).description,
    "",
  );
});

test("pending legacy requests reopen through the legacy contract; withdrawn requests do not block", async () => {
  const session = await patient();
  const departmentId = config.departments.find((d) => d.code === "CONSULT").id;
  const old = await call(session.token, "/api/requests", {
    name: "Old fixture",
    contact: input.contact,
    description: "Legacy original",
    requests: "",
    departmentId,
  });
  const conflict = await call(session.token, "/api/v2/requests", input, 409);
  assert.equal(conflict.existingRequestId, old.id);
  assert.equal(conflict.existingRequestContract, "legacy");
  assert.equal(
    (await call(session.token, `/api/requests/${old.id}`)).description,
    "Legacy original",
  );
  await call(session.token, `/api/requests/${old.id}/withdraw`, {});
  await call(session.token, "/api/v2/requests", input, 201);
});

test("active Visit blocks new reception for Account and Guest and returns only an authorized Visit ID", async () => {
  for (const guest of [false, true]) {
    const session = await patient(guest);
    const departmentId = config.departments.find(
      (d) => d.code === "CONSULT",
    ).id;
    const old = await call(session.token, "/api/requests", {
      name: "Active fixture",
      contact: input.contact,
      description: "",
      requests: "",
      departmentId,
    });
    const { visitId } = await call(
      reception.token,
      `/api/requests/${old.id}/confirm`,
      {
        version: 1,
        departmentId,
        locationId: config.locations.find((l) => l.room === "A101").id,
        attendeeVerified: true,
        verificationNote: "Synthetic active Visit",
      },
    );
    const conflict = await call(session.token, "/api/v2/requests", input, 409);
    assert.equal(conflict.existingVisitId, visitId);
    assert.equal(conflict.title, "activeVisitExists");
    assert.deepEqual(await call(session.token, "/api/v2/requests"), []);
    if (guest) {
      const token = randomUUID(),
        hash = createHash("sha256").update(token).digest("hex").toUpperCase();
      fixtureSql(`INSERT INTO Sessions (Id,Version,CreatedAt,PatientId,UserAccountId,TokenHash,IsGuest,ExpiresAt,Revoked)
        VALUES (NEWID(),1,SYSUTCDATETIME(),'${session.patientId}',NULL,'${hash}',1,DATEADD(hour,1,SYSUTCDATETIME()),0);`);
      const denied = await call(token, "/api/v2/requests", input, 409);
      assert.equal(denied.title, "activeVisitExists");
      assert.equal(denied.existingVisitId, null);
    }
  }
});
