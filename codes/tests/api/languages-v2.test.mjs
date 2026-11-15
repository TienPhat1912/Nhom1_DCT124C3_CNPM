import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.API_URL;
const primary = ["vi", "en", "zh", "ja"];
async function api(
  path,
  token,
  body,
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
  assert.equal(
    response.status,
    200,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  return data;
}
for (const legacy of ["ko", "ru"])
  test(`PB027 metadata and legacy ${legacy}: four UI locales never mutate preference, Visit keys or steps`, async () => {
    const config = await api("/api/config");
    assert.deepEqual(config.languages, primary);
    const session = await api("/api/auth/guest", null, { language: legacy });
    const token = session.token;
    assert.equal((await api("/api/visits", token)).length, 0);
    for (const language of primary) {
      const entry = await api(`/api/entry?language=${language}`, token);
      assert.deepEqual(entry.languages, primary);
      assert.equal(entry.createsVisit, false);
    }
    assert.equal((await api("/api/visits", token)).length, 0);
    const department = config.departments.find(
      (department) => department.code === "CONSULT",
    );
    const location = config.locations.find(
      (location) => location.room === "A101",
    );
    const request = await api("/api/requests", token, {
      name: "PB027 Legacy Patient",
      contact: "test-contact",
      description: "Legacy attendance fixture",
      requests: "",
      departmentId: department.id,
    });
    const staff = await api("/api/auth/login", null, {
      email: "reception@demo.local",
      password: process.env.DEMO_PASSWORD,
    });
    const current = await api(`/api/requests/${request.id}`, staff.token);
    const confirmed = await api(
      `/api/requests/${request.id}/confirm`,
      staff.token,
      {
        version: current.version,
        departmentId: department.id,
        locationId: location.id,
        attendeeVerified: true,
        verificationNote: "Verified synthetic legacy language test",
      },
    );
    const path = `/api/visits/${confirmed.visitId}`;
    const original = await api(path, token);
    const identity = (visit) => ({
      id: visit.id,
      version: visit.version,
      status: visit.status,
      journeyStatus: visit.journeyStatus,
      steps: visit.steps.map((step) => ({
        id: step.id,
        version: step.version,
        status: step.status,
        queueStatus: step.queueStatus,
      })),
    });
    const beforeProfile = await api("/api/auth/profile", token);
    assert.equal(beforeProfile.language, legacy);
    for (const language of primary) {
      const visit = await api(`${path}?language=${language}`, token);
      assert.deepEqual(identity(visit), identity(original));
      assert.ok(
        (await api(`/api/visits?language=${language}`, token)).some(
          (visit) => visit.id === original.id,
        ),
      );
    }
    assert.deepEqual(await api("/api/auth/profile", token), beforeProfile);
    assert.equal((await api("/api/auth/session", token)).language, legacy);
  });
