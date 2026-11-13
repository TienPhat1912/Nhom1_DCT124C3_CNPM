import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "../api/sql-fixture.mjs";

export { fixtureSql };
assert.ok(
  process.env.API_URL && process.env.DEMO_PASSWORD && process.env.ACCEPTANCE_DB,
);
export async function call(
  token,
  path,
  body,
  status = 200,
  key = randomUUID(),
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(process.env.API_URL + path, {
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
  assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`);
  return result;
}
export async function login(email = "admin@demo.local") {
  return call(null, "/api/auth/login", {
    email,
    password: process.env.DEMO_PASSWORD,
  });
}
export const path = (id, operation = "assignment") =>
  `/api/v2/admin/clinics/${id}/${operation}`;
export const read = (admin, id) => call(admin.token, path(id));
export const put = (admin, id, operation, input, status = 200, key) =>
  call(admin.token, path(id, operation), input, status, key, "PUT");
export async function doctor(admin, departmentId, extra = {}) {
  return call(admin.token, "/api/admin/staff", {
    version: 0,
    email: `${randomUUID()}@example.test`,
    name: "PB005 Doctor",
    role: "Doctor",
    active: true,
    departmentIds: [departmentId],
    password: process.env.DEMO_PASSWORD,
    ...extra,
  });
}
export async function location(admin, departmentId) {
  return call(admin.token, "/api/admin/locations", {
    version: 0,
    departmentId,
    nameVi: `Phòng PB005 ${randomUUID().slice(0, 8)}`,
    building: "A",
    floor: "1",
    room: "PB005",
    active: true,
  });
}
export function scalar(query) {
  const output = fixtureSql(`SET NOCOUNT ON; SELECT (${query}) AS Value;`);
  return Number(
    output
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => /^\d+$/.test(s)),
  );
}
