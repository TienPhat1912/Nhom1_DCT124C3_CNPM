import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";

const base = process.env.API_URL,
  mock = process.env.MOCK_TRANSLATION_URL;
const password = process.env.DEMO_PASSWORD;
const stats = async () => await (await fetch(mock + "/stats")).json();
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
  assert.equal(response.status, expected, path);
  return response.json();
}
test("PB018 authorizes before translation, preserves stored originals and retries failures", async () => {
  const patient = await call(null, "/api/auth/register", {
    email: `${randomUUID()}@example.test`,
    password,
    name: "PB018 identity",
    contact: "synthetic-contact",
    language: "ja",
  });
  const reception = await call(null, "/api/auth/login", {
    email: "reception@demo.local",
    password,
  });
  const doctor = await call(null, "/api/auth/login", {
    email: "doctor@demo.local",
    password,
  });
  const email = `scope-${randomUUID()}@example.test`;
  fixtureSql(`INSERT INTO Users (Id,Version,CreatedAt,Email,PasswordHash,Name,Role,PatientId,Active)
    SELECT NEWID(),1,SYSUTCDATETIME(),'${email}',PasswordHash,'PB018 scoped','Reception',NULL,1
    FROM Users WHERE Email='doctor@demo.local';`);
  const wrong = await call(null, "/api/auth/login", { email, password });
  const original = "  Original description\n" + randomUUID();
  const before = (await stats()).length;
  const request = await call(
    patient.token,
    "/api/v2/requests",
    {
      contact: "synthetic-contact",
      preferredDepartmentId: null,
      description: original,
      sourceLanguage: "en",
    },
    201,
  );
  await call(reception.token, "/api/v2/requests");
  await call(patient.token, `/api/v2/requests/${request.id}`);
  await call(reception.token, `/api/v2/requests/${request.id}`);
  const path = `/api/v2/requests/${request.id}/translation`;
  for (const [token, code] of [
    [null, 401],
    [patient.token, 403],
    [doctor.token, 403],
    [wrong.token, 403],
  ])
    await call(token, path, undefined, code);
  assert.equal(
    (await stats()).length,
    before,
    "submit/list/plain detail/unauthorized reads never call provider",
  );
  const profile = await call(patient.token, "/api/auth/profile");
  await call(
    patient.token,
    "/api/auth/profile",
    {
      name: profile.name,
      contact: profile.contact,
      language: "zh",
      version: profile.version,
    },
    200,
    "PUT",
  );
  const translated = await call(
    reception.token,
    path + "?language=ja&sourceLanguage=ja&targetLanguage=en",
  );
  assert.deepEqual(translated, {
    original,
    sourceLanguage: "en",
    targetLanguage: "vi",
    sourceVersion: request.version,
    status: "Translated",
    translated: "Bản Việt: " + original,
    fallback: false,
  });
  const calls = await stats();
  assert.equal(calls.length, before + 1);
  assert.deepEqual(
    calls.at(-1).texts,
    [{ text: original }],
    "Only description is sent, no identity/contact/context",
  );
  assert.match(calls.at(-1).url, /from=en&to=vi/);
  await call(wrong.token, path, undefined, 403); // Even a cached translation remains scoped.
  await call(reception.token, path);
  assert.equal((await stats()).length, before + 1);
  // New record has its own cache context and can recover after provider failure.
  const guest = await call(null, "/api/auth/register", {
    email: `${randomUUID()}@example.test`,
    password,
    name: "PB018 retry",
    contact: "synthetic-contact",
    language: "en",
  });
  const retry = await call(
    guest.token,
    "/api/v2/requests",
    {
      contact: "synthetic-contact",
      preferredDepartmentId: null,
      description: original,
      sourceLanguage: "en",
    },
    201,
  );
  await fetch(mock + "/fail");
  const failure = await call(
    reception.token,
    `/api/v2/requests/${retry.id}/translation`,
  );
  assert.equal(failure.status, "Unavailable");
  assert.equal(failure.original, original);
  assert.equal(failure.translated, null);
  await fetch(mock + "/recover");
  assert.equal(
    (await call(reception.token, `/api/v2/requests/${retry.id}/translation`))
      .status,
    "Translated",
  );
  const unchanged = await call(guest.token, `/api/v2/requests/${retry.id}`);
  assert.equal(unchanged.description, original);
  assert.equal(unchanged.version, retry.version);
  assert.equal(unchanged.sourceLanguage, "en");
  assert.equal(unchanged.status, "Submitted");
  fixtureSql(`UPDATE Requests SET SourceLanguage='vi' WHERE Id='${retry.id}';`);
  const count = (await stats()).length;
  assert.equal(
    (await call(reception.token, `/api/v2/requests/${retry.id}/translation`))
      .status,
    "NotRequired",
  );
  assert.equal((await stats()).length, count);
  for (const sourceLanguage of ["zh", "ja"]) {
    fixtureSql(
      `UPDATE Requests SET SourceLanguage='${sourceLanguage}' WHERE Id='${retry.id}';`,
    );
    const result = await call(
      reception.token,
      `/api/v2/requests/${retry.id}/translation?language=en`,
    );
    assert.equal(result.sourceLanguage, sourceLanguage);
    assert.equal(result.original, original);
    assert.equal(result.status, "Translated");
    assert.match(
      (await stats()).at(-1).url,
      new RegExp(`from=${sourceLanguage === "zh" ? "zh-Hans" : "ja"}&to=vi`),
    );
  }
  fixtureSql(
    `UPDATE Requests SET Description='  ',SourceLanguage='en' WHERE Id='${retry.id}';`,
  );
  const beforeBlank = (await stats()).length;
  const blank = await call(
    reception.token,
    `/api/v2/requests/${retry.id}/translation`,
  );
  assert.equal(blank.status, "NotRequired");
  assert.equal(blank.original, "  ");
  fixtureSql(`UPDATE Requests SET SourceLanguage=NULL WHERE Id='${retry.id}';`);
  assert.equal(
    (
      await call(
        reception.token,
        `/api/v2/requests/${retry.id}/translation`,
        undefined,
        409,
      )
    ).title,
    "legacyRecord",
  );
  await call(
    reception.token,
    `/api/v2/requests/${randomUUID()}/translation`,
    undefined,
    404,
  );
  assert.equal(
    (await stats()).length,
    beforeBlank,
    "Blank, legacy and missing records never call provider",
  );
});
