import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL,
  password = process.env.DEMO_PASSWORD,
  mock = process.env.MOCK_TRANSLATION_URL;
async function call(
  token,
  path,
  body,
  expected = 200,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(base + path, {
    method,
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
const stats = async () => (await (await fetch(mock + "/stats")).json()).length;
test("PB019 before Visit, ownership, Reception scope, detail-only translation and versioned handling", async () => {
  const reception = await call(null, "/api/auth/login", {
    email: "reception@demo.local",
    password,
  });
  const service = await call(null, "/api/auth/login", {
    email: "service@demo.local",
    password,
  });
  const email = `scope-${randomUUID()}@example.test`;
  fixtureSql(`INSERT INTO Users (Id,Version,CreatedAt,Email,PasswordHash,Name,Role,PatientId,Active)
    SELECT NEWID(),1,SYSUTCDATETIME(),'${email}',PasswordHash,'PB019 scope','Reception',NULL,1 FROM Users WHERE Email='reception@demo.local';`);
  const wrong = await call(null, "/api/auth/login", { email, password });
  const owners = [
    await call(null, "/api/auth/guest", { language: "en" }),
    await call(null, "/api/auth/register", {
      email: `${randomUUID()}@example.test`,
      password,
      name: "PB019 account",
      contact: "synthetic-contact",
      language: "ja",
    }),
  ];
  for (const owner of owners) {
    const description = "  Original help\n" + randomUUID();
    const input = {
      category: "Language",
      description,
      sourceLanguage: "en",
      visitId: null,
      requestId: null,
      stepId: null,
    };
    const count = await stats();
    const created = await call(owner.token, "/api/assistance", input);
    let row = (await call(owner.token, "/api/assistance")).find(
      (a) => a.id === created.id,
    );
    assert.equal(row.description, description);
    assert.equal(row.sourceLanguage, "en");
    assert.equal(row.visitId, null);
    assert.ok(
      (await call(reception.token, "/api/assistance?language=ja")).some(
        (a) => a.id === row.id,
      ),
    );
    assert.ok(
      !(
        await call(owners.find((x) => x !== owner).token, "/api/assistance")
      ).some((a) => a.id === row.id),
    );
    const path = `/api/assistance/${row.id}`;
    await call(service.token, "/api/assistance", undefined, 403);
    for (const token of [service.token, wrong.token, owner.token])
      await call(token, path, undefined, 403);
    assert.equal(await stats(), count);
    await fetch(mock + "/fail");
    const fallback = await call(reception.token, path);
    assert.equal(fallback.translation.status, "Unavailable");
    assert.equal(fallback.translation.original, description);
    const update = (version, status) => ({
      version,
      status,
      resolution: "Reception assisted",
      escalate: false,
      departmentId: null,
    });
    await call(
      service.token,
      path,
      update(row.version, "Acknowledged"),
      403,
      "PUT",
    );
    await call(
      wrong.token,
      path,
      update(row.version, "Acknowledged"),
      403,
      "PUT",
    );
    await call(
      reception.token,
      path,
      update(row.version, "Resolved"),
      409,
      "PUT",
    );
    await call(
      reception.token,
      path,
      update(row.version, "Acknowledged"),
      200,
      "PUT",
    );
    await call(
      reception.token,
      path,
      update(row.version, "Resolved"),
      409,
      "PUT",
    );
    row = (await call(owner.token, "/api/assistance")).find(
      (a) => a.id === row.id,
    );
    assert.equal(row.status, "Acknowledged");
    await fetch(mock + "/recover");
    const result = await call(reception.token, path + "?language=ja");
    assert.equal(result.translation.translated, "Bản Việt: " + description);
    assert.equal(result.translation.sourceLanguage, "en");
    const cachedCount = await stats();
    await call(wrong.token, path, undefined, 403);
    await call(reception.token, path);
    assert.equal(await stats(), cachedCount);
    await call(
      reception.token,
      path,
      { ...update(row.version, "Acknowledged"), escalate: true },
      422,
      "PUT",
    );
    await call(
      reception.token,
      path,
      update(row.version, "Resolved"),
      200,
      "PUT",
    );
    const resolved = (await call(owner.token, "/api/assistance")).find(
      (a) => a.id === row.id,
    );
    assert.equal(resolved.status, "Resolved");
    assert.equal(resolved.description, description);
    await call(
      reception.token,
      path,
      update(resolved.version, "Acknowledged"),
      409,
      "PUT",
    );
    await call(
      owner.token,
      "/api/assistance",
      { ...input, stepId: randomUUID() },
      422,
    );
    await call(
      owner.token,
      "/api/assistance",
      { ...input, sourceLanguage: "xx" },
      422,
    );
  }
});
test("service-area context retains Visit/Step/location but routes to Visit Reception", async () => {
  const reception = await call(null, "/api/auth/login", {
    email: "reception@demo.local",
    password,
  });
  const patient = await call(null, "/api/auth/register", {
    email: `${randomUUID()}@example.test`,
    password,
    name: "PB019 context",
    contact: "synthetic-contact",
    language: "en",
  });
  const request = await call(
    patient.token,
    "/api/v2/requests",
    {
      contact: "synthetic-contact",
      preferredDepartmentId: null,
      description: "",
      sourceLanguage: "vi",
    },
    201,
  );
  const clinic = (await call(reception.token, "/api/v2/reception/clinics"))[0];
  const confirmed = await call(
    reception.token,
    `/api/v2/requests/${request.id}/confirm`,
    {
      version: request.version,
      clinicLocationId: clinic.clinicLocationId,
      clinicAssignmentVersion: clinic.version,
      attendeeVerified: true,
      verificationNote: "Synthetic context",
    },
  );
  const visitId = confirmed.visit.id;
  // A historical service step fixture uses a different department from reception.
  const stepId = fixtureSql(
    `SET NOCOUNT ON; SELECT TOP 1 s.Id FROM JourneyStep s JOIN PatientJourney j ON s.PatientJourneyId=j.Id WHERE j.VisitId='${visitId}';`,
  ).match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i)?.[0];
  assert.ok(stepId);
  fixtureSql(
    `UPDATE JourneyStep SET DepartmentId=(SELECT TOP 1 Id FROM Department WHERE Code<>'CONSULT') WHERE Id='${stepId}';`,
  );
  const input = {
    category: "Navigation",
    description: "At service area",
    sourceLanguage: "en",
    visitId,
    requestId: null,
    stepId,
  };
  const created = await call(patient.token, "/api/assistance", input);
  const row = (await call(reception.token, "/api/assistance")).find(
    (a) => a.id === created.id,
  );
  assert.ok(row);
  assert.equal(row.visitId, visitId);
  assert.equal(row.journeyStepId, stepId.toLowerCase());
  assert.ok(row.locationId);
  assert.ok(row.destinationSnapshot);
  await call(
    patient.token,
    "/api/assistance",
    { ...input, stepId: randomUUID() },
    422,
  );
});
