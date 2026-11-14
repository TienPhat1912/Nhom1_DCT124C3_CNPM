import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL,
  password = process.env.DEMO_PASSWORD;
async function call(
  token,
  path,
  body,
  expected = 200,
  method = body === undefined ? "GET" : "POST",
  key = randomUUID(),
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
  const data = await response.json();
  assert.equal(response.status, expected, `${path}: ${data.title ?? ""}`);
  return data;
}
const hash = (value) =>
  createHash("sha256").update(value).digest("hex").toUpperCase();
const verified = {
  attendeeVerified: true,
  verificationNote: "Synthetic PB020 identity verification",
};
test("PB020 room/day collisions, scoped issuance and single-use recovery preserve identity and Journey", async () => {
  const staff = await call(null, "/api/auth/login", {
    email: "reception@demo.local",
    password,
  });
  const service = await call(null, "/api/auth/login", {
    email: "service@demo.local",
    password,
  });
  const email = `scope-${randomUUID()}@example.test`;
  fixtureSql(`INSERT Users (Id,Version,CreatedAt,Email,PasswordHash,Name,Role,Active)
    SELECT NEWID(),1,SYSUTCDATETIME(),'${email}',PasswordHash,'PB020 scope','Reception',1 FROM Users WHERE Email='reception@demo.local';`);
  const wrong = await call(null, "/api/auth/login", { email, password });
  const clinics = await call(staff.token, "/api/v2/reception/clinics");
  assert.ok(clinics.length >= 2);
  async function attendance(clinic, date) {
    const guest = await call(null, "/api/auth/guest", { language: "en" });
    await call(
      guest.token,
      "/api/auth/profile",
      {
        name: "PB020 historical guest",
        contact: "synthetic-contact",
        language: "en",
        version: 1,
      },
      200,
      "PUT",
    );
    const request = await call(
      guest.token,
      "/api/v2/requests",
      {
        contact: "synthetic-contact",
        description: "Original",
        sourceLanguage: "en",
        preferredDepartmentId: null,
      },
      201,
    );
    const result = await call(
      staff.token,
      `/api/v2/requests/${request.id}/confirm`,
      {
        version: request.version,
        clinicLocationId: clinic.clinicLocationId,
        clinicAssignmentVersion: clinic.version,
        ...verified,
      },
    );
    fixtureSql(
      `UPDATE ExaminationTicket SET IssuedOn='${date}',SequenceNumber=1,Number='001' WHERE VisitId='${result.visit.id}';`,
    );
    return { guest, ...result };
  }
  const first = await attendance(clinics[0], "2040-02-01");
  const otherRoom = await attendance(clinics[1], "2040-02-01");
  const otherDay = await attendance(clinics[0], "2040-02-02");
  const lookup = "/api/reception/guest-tickets?number=1&issuedOn=2040-02-01";
  await call(null, lookup, undefined, 401);
  await call(service.token, lookup, undefined, 403);
  assert.equal((await call(wrong.token, lookup)).items.length, 0);
  assert.deepEqual(
    new Set((await call(staff.token, lookup)).items.map((i) => i.visitId)),
    new Set([first.visit.id, otherRoom.visit.id]),
  );
  assert.deepEqual(
    (
      await call(
        staff.token,
        lookup + `&clinicLocationId=${clinics[0].clinicLocationId}`,
      )
    ).items.map((i) => i.visitId),
    [first.visit.id],
  );
  assert.deepEqual(
    (await call(staff.token, lookup.replace("02-01", "02-02"))).items.map(
      (i) => i.visitId,
    ),
    [otherDay.visit.id],
  );
  await call(
    staff.token,
    lookup.replace("number=1", "number=0"),
    undefined,
    422,
  );
  const path = `/api/visits/${first.visit.id}/recovery`;
  for (const token of [wrong.token, service.token, first.guest.token])
    await call(token, path, verified, 403);
  await call(staff.token, path, { ...verified, attendeeVerified: false }, 422);
  await call(staff.token, path, { ...verified, verificationNote: "" }, 422);
  const old = await call(staff.token, path, verified);
  const fresh = await call(staff.token, path, verified);
  assert.ok(Date.parse(fresh.expiresAt) > Date.now());
  assert.ok(Date.parse(fresh.expiresAt) <= Date.now() + 601000);
  await call(null, "/api/auth/recover", { code: old.recoveryCode }, 403);
  const beforeProfile = await call(first.guest.token, "/api/auth/profile");
  const original = await call(
    first.guest.token,
    `/api/visits/${first.visit.id}`,
  );
  const redeemed = await call(null, "/api/auth/recover", {
    code: fresh.recoveryCode,
  });
  assert.equal(redeemed.visitId, first.visit.id);
  assert.equal(redeemed.session.isGuest, true);
  assert.equal(redeemed.session.patientId, first.guest.patientId);
  assert.notEqual(redeemed.session.sessionId, first.guest.sessionId);
  assert.deepEqual(
    await call(redeemed.session.token, "/api/auth/profile"),
    beforeProfile,
  );
  const recovered = await call(
    redeemed.session.token,
    `/api/visits/${first.visit.id}`,
  );
  assert.equal(recovered.id, original.id);
  assert.equal(recovered.journeyId, original.journeyId);
  assert.deepEqual(
    (await call(redeemed.session.token, "/api/visits")).map((v) => v.id),
    [first.visit.id],
  );
  await call(
    redeemed.session.token,
    `/api/visits/${otherRoom.visit.id}`,
    undefined,
    403,
  );
  await call(null, "/api/auth/recover", { code: fresh.recoveryCode }, 403);
  const expiring = await call(staff.token, path, verified);
  fixtureSql(
    `UPDATE RecoveryClaim SET ExpiresAt=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE Hash='${hash(expiring.recoveryCode)}';`,
  );
  await call(null, "/api/auth/recover", { code: expiring.recoveryCode }, 403);
  await call(null, "/api/auth/recover", { code: "" }, 403);
  const concurrent = await call(staff.token, path, verified);
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      fetch(base + "/api/auth/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hospital-Client": "1",
          "X-Client": "native",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({ code: concurrent.recoveryCode }),
      }),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 200).length, 1);
  assert.equal(responses.filter((r) => r.status === 403).length, 4);
  const independent = await call(null, "/api/auth/register", {
    email: `${randomUUID()}@example.test`,
    password,
    name: beforeProfile.name,
    contact: beforeProfile.contact,
    language: "en",
  });
  assert.equal((await call(independent.token, "/api/visits")).length, 0);
  await call(
    independent.token,
    `/api/visits/${first.visit.id}`,
    undefined,
    403,
  );
  // No Visit was created by any issuance/claim: the original guest still has one attendance.
  assert.deepEqual(
    (await call(first.guest.token, "/api/visits")).map((v) => v.id),
    [first.visit.id],
  );
});
