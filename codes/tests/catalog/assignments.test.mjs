import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  call,
  login,
  path,
  read,
  put,
  doctor,
  location,
  fixtureSql,
  scalar,
} from "./assignment-fixture.mjs";

let admin, config, dep, otherDep;
before(async () => {
  admin = await login();
  config = await call(admin.token, "/api/admin/configuration");
  admin.userId = config.staff.find((u) => u.email === "admin@demo.local").id;
  dep = config.departments.find((d) => d.code === "CONSULT").id;
  otherDep = config.departments.find((d) => d.code === "OTHER").id;
});
async function setup() {
  const room = await location(admin, dep);
  const first = await doctor(admin, dep);
  const second = await doctor(admin, dep);
  const assignment = await put(admin, room.id, "doctors", {
    version: 0,
    doctorIds: [first.id, second.id],
  });
  return { room, first, second, assignment };
}

test("Admin-only read/write and strict input validation", async () => {
  const { room, first, assignment } = await setup();
  const openapi = await call(null, "/openapi/v1.json");
  for (const operation of ["doctors", "active-doctor"]) {
    const spec = openapi.paths[`/api/v2/admin/clinics/{id}/${operation}`].put;
    assert.ok(spec.requestBody.content["application/json"].schema.$ref);
    assert.ok(spec.responses["200"].content["application/json"].schema.$ref);
  }
  await call(null, path(room.id), undefined, 401);
  for (const email of [
    "patient",
    "reception",
    "doctor",
    "service",
    "cashier",
  ]) {
    const session = await login(`${email}@demo.local`);
    await call(session.token, "/api/v2/admin/clinics", undefined, 403);
    await call(session.token, path(room.id), undefined, 403);
    for (const operation of ["doctors", "active-doctor"])
      await call(
        session.token,
        path(room.id, operation),
        { version: assignment.version, doctorId: first.id },
        403,
        randomUUID(),
        "PUT",
      );
  }
  const guest = await call(null, "/api/auth/guest", { language: "vi" });
  await call(guest.token, path(room.id), undefined, 403);
  for (const input of [
    null,
    {},
    { version: 1 },
    { version: -1, doctorId: null },
    { version: 1.5, doctorId: null },
    { version: "1", doctorId: null },
    { version: 1, doctorId: "bad" },
    { version: 1, doctorId: first.id, actorId: admin.userId },
  ])
    await put(admin, room.id, "active-doctor", input, 422);
  for (const input of [
    { version: 1, doctorIds: null },
    { version: 1, doctorIds: [first.id, first.id] },
    { version: 1, doctorIds: [null] },
    { version: 1, doctorIds: [], status: "Active" },
  ])
    await put(admin, room.id, "doctors", input, 422);
  await put(
    admin,
    room.id,
    "active-doctor",
    { version: 1, doctorId: first.id },
    422,
    "short",
  );
  await call(admin.token, path(randomUUID()), undefined, 404);
  assert.equal((await read(admin, room.id)).activeDoctor, null);
});

test("usable Doctor, matching scope and explicit membership required", async () => {
  const { room, first, assignment } = await setup();
  const wrongScope = await doctor(admin, otherDep);
  const disabled = await doctor(admin, dep, { active: false });
  const reception = await doctor(admin, dep, { role: "Reception" });
  const directory = config.staff.find(
    (d) => d.directoryOnly && d.departmentIds.includes(dep),
  );
  assert.ok(directory, "Roster fixture includes a directory-only Doctor");
  for (const [id, status] of [
    [wrongScope.id, 422],
    [disabled.id, 409],
    [reception.id, 422],
    [directory.id, 409],
    [randomUUID(), 422],
  ])
    await put(
      admin,
      room.id,
      "doctors",
      { version: assignment.version, doctorIds: [first.id, id] },
      status,
    );
  await put(
    admin,
    room.id,
    "active-doctor",
    { version: assignment.version, doctorId: wrongScope.id },
    422,
  );
  const other = await location(admin, dep);
  await put(
    admin,
    other.id,
    "doctors",
    { version: 0, doctorIds: [first.id] },
    409,
  );
  const selected = await put(admin, room.id, "active-doctor", {
    version: assignment.version,
    doctorId: first.id,
  });
  assert.equal(selected.activeDoctor.id, first.id);
  assert.equal(selected.activeDoctorUsable, true);
  const sessionConfig = await call(admin.token, "/api/admin/configuration");
  const user = sessionConfig.staff.find((u) => u.id === first.id);
  await call(
    admin.token,
    "/api/admin/staff",
    { ...user, role: "Reception", password: null },
    409,
  );
  await call(
    admin.token,
    "/api/admin/staff",
    { ...user, departmentIds: [otherDep], password: null },
    409,
  );
  const loc = sessionConfig.locations.find((l) => l.id === room.id);
  await call(
    admin.token,
    "/api/admin/locations",
    { ...loc, departmentId: otherDep },
    409,
  );
});

test("concurrent Admin choices, version, replay and atomic audit", async () => {
  const { room, first, second, assignment } = await setup();
  const secondAdmin = await doctor(admin, dep, { role: "Admin" });
  const secondConfig = await call(admin.token, "/api/admin/configuration");
  const otherAdmin = await login(
    secondConfig.staff.find((u) => u.id === secondAdmin.id).email,
  );
  const attempt = async (actor, id) => {
    const response = await fetch(
      process.env.API_URL + path(room.id, "active-doctor"),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${actor.token}`,
          "X-Client": "native",
          "X-Hospital-Client": "1",
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({ version: assignment.version, doctorId: id }),
      },
    );
    return response.status;
  };
  assert.deepEqual(
    (
      await Promise.all([
        attempt(admin, first.id),
        attempt(otherAdmin, second.id),
      ])
    ).sort(),
    [200, 409],
  );
  const selected = await read(admin, room.id);
  assert.equal(selected.version, assignment.version + 1);
  assert.equal(
    scalar(
      `SELECT COUNT(*) FROM ClinicRoom WHERE ClinicLocationId='${room.id}' AND ActiveDoctorId IS NOT NULL`,
    ),
    1,
  );
  const nextId = selected.activeDoctor.id === first.id ? second.id : first.id;
  const key = randomUUID(),
    input = { version: selected.version, doctorId: nextId };
  const saved = await put(admin, room.id, "active-doctor", input, 200, key);
  assert.deepEqual(
    await put(admin, room.id, "active-doctor", input, 200, key),
    saved,
  );
  await put(
    admin,
    room.id,
    "active-doctor",
    { ...input, doctorId: null },
    409,
    key,
  );
  await put(admin, room.id, "active-doctor", input, 409);
  const audits = await call(admin.token, "/api/admin/audit");
  const audit = audits.find(
    (e) =>
      e.type === "ClinicActiveDoctorConfigured" &&
      e.sourceEventId.endsWith(key),
  );
  assert.equal(audit.actorId, admin.userId);
  assert.ok(audit.createdAt);
  assert.deepEqual(JSON.parse(audit.detail), {
    clinicLocationId: room.id,
    before: selected.activeDoctor.id,
    after: nextId,
  });
  assert.equal(
    scalar(
      `SELECT COUNT(*) FROM AuditEvent WHERE SourceEventId='${admin.userId.replaceAll("-", "")}:ClinicActiveDoctorConfigured:${key}'`,
    ),
    1,
  );
});

test("membership edits share room version, clearing duty and reassignment remain explicit", async () => {
  const { room, first, second, assignment } = await setup();
  const selected = await put(admin, room.id, "active-doctor", {
    version: assignment.version,
    doctorId: first.id,
  });
  await put(
    admin,
    room.id,
    "doctors",
    { version: selected.version, doctorIds: [second.id] },
    409,
  );
  const cleared = await put(admin, room.id, "active-doctor", {
    version: selected.version,
    doctorId: null,
  });
  const changed = await put(admin, room.id, "doctors", {
    version: cleared.version,
    doctorIds: [second.id],
  });
  assert.equal(changed.version, cleared.version + 1);
  await put(
    admin,
    room.id,
    "active-doctor",
    { version: cleared.version, doctorId: second.id },
    409,
  );
  const destination = await location(admin, dep);
  await put(admin, destination.id, "doctors", {
    version: 0,
    doctorIds: [first.id],
  });
  assert.equal(
    scalar(`SELECT COUNT(*) FROM ClinicDoctor WHERE DoctorId='${first.id}'`),
    1,
  );
  const staffConfig = await call(admin.token, "/api/admin/configuration");
  const user = staffConfig.staff.find((u) => u.id === first.id);
  const session = await login(user.email);
  const profile = await call(session.token, "/api/staff/profile");
  assert.deepEqual(
    profile.clinics.map((c) => c.id),
    [destination.id],
  );
});

async function openVisit(room, assignment) {
  const session = await call(null, "/api/auth/register", {
    email: `${randomUUID()}@example.test`,
    password: process.env.DEMO_PASSWORD,
    name: "PB005 Patient",
    contact: "test-contact",
    language: "vi",
  });
  const request = await call(
    session.token,
    "/api/v2/requests",
    {
      contact: "test-contact",
      preferredDepartmentId: null,
      description: "PB005 test",
      sourceLanguage: "vi",
    },
    201,
  );
  const reception = await login("reception@demo.local");
  return {
    session,
    reception,
    request,
    input: {
      version: request.version,
      clinicLocationId: room.id,
      clinicAssignmentVersion: assignment.version,
      attendeeVerified: true,
      verificationNote: "Verified fixture attendee",
    },
  };
}

test("all Active Visit states lock assignments, security disable takes effect without transferring duty", async () => {
  const { room, first, second, assignment } = await setup();
  const selected = await put(admin, room.id, "active-doctor", {
    version: assignment.version,
    doctorId: first.id,
  });
  const { session, reception, request, input } = await openVisit(
    room,
    selected,
  );
  const confirmed = await call(
    reception.token,
    `/api/v2/requests/${request.id}/confirm`,
    input,
  );
  const doctorConfig = await call(admin.token, "/api/admin/configuration");
  const user = doctorConfig.staff.find((u) => u.id === first.id);
  const doctorSession = await login(user.email);
  const wrongDoctor = await login(
    doctorConfig.staff.find((u) => u.id === second.id).email,
  );
  await call(doctorSession.token, `/api/visits/${confirmed.visit.id}`);
  await call(
    wrongDoctor.token,
    `/api/visits/${confirmed.visit.id}`,
    undefined,
    403,
  );
  for (const state of ["Waiting", "InConsultation", "InService", "Completed"]) {
    fixtureSql(
      `UPDATE Visits SET ExamStatus='${state}' WHERE Id='${confirmed.visit.id}';`,
    );
    const current = await read(admin, room.id);
    assert.equal(current.canChangeDoctor, false);
    assert.equal(current.activeVisitCount, 1);
    for (const doctorId of [second.id, null])
      assert.equal(
        (
          await put(
            admin,
            room.id,
            "active-doctor",
            { version: current.version, doctorId },
            409,
          )
        ).title,
        "clinicHasActiveVisits",
      );
    await put(
      admin,
      room.id,
      "doctors",
      { version: current.version, doctorIds: [first.id] },
      409,
    );
  }
  await call(admin.token, "/api/admin/staff", {
    ...user,
    active: false,
    password: null,
  });
  await call(doctorSession.token, "/api/staff/profile", undefined, 401);
  await call(
    null,
    "/api/auth/login",
    { email: user.email, password: process.env.DEMO_PASSWORD },
    401,
  );
  const locked = await read(admin, room.id);
  assert.equal(locked.activeDoctor.id, first.id);
  assert.equal(locked.activeDoctorUsable, false);
  assert.equal(
    (await call(session.token, `/api/visits/${confirmed.visit.id}`)).doctorId,
    first.id,
  );
  assert.equal(
    (await call(reception.token, "/api/v2/reception/clinics")).some(
      (c) => c.clinicLocationId === room.id,
    ),
    false,
  );
  fixtureSql(
    `UPDATE Visits SET Status='Closed',ClosedAt=SYSUTCDATETIME() WHERE Id='${confirmed.visit.id}';`,
  );
  const available = await read(admin, room.id);
  assert.equal(available.canChangeDoctor, true);
  const replacement = await put(admin, room.id, "active-doctor", {
    version: available.version,
    doctorId: second.id,
  });
  assert.equal(replacement.activeDoctor.id, second.id);
  assert.equal(
    (await call(session.token, `/api/visits/${confirmed.visit.id}`)).doctorId,
    first.id,
  );
});

test("legacy Active Visits and unassigned doctors with Active Visits block membership changes", async () => {
  const { room, first, second, assignment } = await setup();
  const selected = await put(admin, room.id, "active-doctor", {
    version: assignment.version,
    doctorId: first.id,
  });
  const { reception, request, input } = await openVisit(room, selected);
  const confirmed = await call(
    reception.token,
    `/api/v2/requests/${request.id}/confirm`,
    input,
  );
  fixtureSql(
    `UPDATE Visits SET ClinicLocationId=NULL,ExamStatus=NULL WHERE Id='${confirmed.visit.id}';`,
  );
  assert.equal((await read(admin, room.id)).canChangeDoctor, false);
  await put(
    admin,
    room.id,
    "active-doctor",
    { version: selected.version, doctorId: second.id },
    409,
  );
  const elsewhere = await location(admin, dep);
  fixtureSql(
    `UPDATE Visits SET DoctorId='${second.id}' WHERE Id='${confirmed.visit.id}';`,
  );
  await put(
    admin,
    room.id,
    "doctors",
    { version: selected.version, doctorIds: [first.id] },
    409,
  );
  await put(
    admin,
    elsewhere.id,
    "doctors",
    { version: 0, doctorIds: [second.id] },
    409,
  );
});

test("reception confirmation and Admin change race preserves one consistent doctor snapshot", async () => {
  const { room, first, second, assignment } = await setup();
  const selected = await put(admin, room.id, "active-doctor", {
    version: assignment.version,
    doctorId: first.id,
  });
  const { reception, request, input } = await openVisit(room, selected);
  const send = async (token, url, body, method) => {
    const response = await fetch(process.env.API_URL + url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Client": "native",
        "X-Hospital-Client": "1",
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, result: await response.json() };
  };
  const [confirm, change] = await Promise.all([
    send(
      reception.token,
      `/api/v2/requests/${request.id}/confirm`,
      input,
      "POST",
    ),
    send(
      admin.token,
      path(room.id, "active-doctor"),
      { version: selected.version, doctorId: second.id },
      "PUT",
    ),
  ]);
  assert.deepEqual([confirm.status, change.status].sort(), [200, 409]);
  const current = await read(admin, room.id);
  if (confirm.status === 200) {
    assert.equal(current.activeDoctor.id, first.id);
    assert.equal(confirm.result.ticket.doctorSnapshot.id, first.id);
    assert.equal(current.canChangeDoctor, false);
  } else {
    assert.equal(current.activeDoctor.id, second.id);
    assert.equal(current.activeVisitCount, 0);
  }
});

test("two rooms competing for one doctor keep a single membership and rollback the losing room", async () => {
  const first = await location(admin, dep),
    second = await location(admin, dep);
  const user = await doctor(admin, dep);
  const attempt = async (room) => {
    const response = await fetch(
      process.env.API_URL + path(room.id, "doctors"),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${admin.token}`,
          "X-Client": "native",
          "X-Hospital-Client": "1",
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify({ version: 0, doctorIds: [user.id] }),
      },
    );
    return { id: room.id, status: response.status };
  };
  const outcomes = await Promise.all([attempt(first), attempt(second)]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  const loser = outcomes.find((r) => r.status === 409);
  assert.equal((await read(admin, loser.id)).version, 0);
  assert.equal(
    scalar(`SELECT COUNT(*) FROM ClinicDoctor WHERE DoctorId='${user.id}'`),
    1,
  );
  assert.equal(
    scalar(
      `SELECT COUNT(*) FROM ClinicRoom WHERE ClinicLocationId='${loser.id}'`,
    ),
    0,
  );
});

test("roster provisioning uses explicit database membership and supports current access checks", async () => {
  const user = config.staff.find(
    (d) => d.directoryOnly && d.departmentIds.includes(dep),
  );
  await call(admin.token, "/api/admin/staff", {
    ...user,
    name: "PB005 roster correction",
    email: `${randomUUID()}@example.test`,
    password: process.env.DEMO_PASSWORD,
  });
  const target = await location(admin, dep);
  const membership = await put(admin, target.id, "doctors", {
    version: 0,
    doctorIds: [user.id],
  });
  const assignment = await put(admin, target.id, "active-doctor", {
    version: membership.version,
    doctorId: user.id,
  });
  const directory = await call(null, "/api/directory");
  const entry = directory.clinicians.find((d) => d.id === user.id);
  assert.equal(entry.name, "PB005 roster correction");
  assert.equal(entry.directoryOnly, false);
  assert.deepEqual(entry.clinicIds, [target.id]);
  const updatedConfig = await call(admin.token, "/api/admin/configuration");
  const session = await login(
    updatedConfig.staff.find((d) => d.id === user.id).email,
  );
  assert.deepEqual(
    (await call(session.token, "/api/staff/profile")).clinics.map((c) => c.id),
    [target.id],
  );
  const { reception, request, input } = await openVisit(target, assignment);
  const confirmed = await call(
    reception.token,
    `/api/v2/requests/${request.id}/confirm`,
    input,
  );
  await call(session.token, `/api/visits/${confirmed.visit.id}`);
  // A historical/malformed assignment cannot give a doctor access to an active Visit in a different room.
  const wrongRoom = await location(admin, dep);
  fixtureSql(
    `UPDATE Visits SET ClinicLocationId='${wrongRoom.id}' WHERE Id='${confirmed.visit.id}';`,
  );
  await call(
    session.token,
    `/api/visits/${confirmed.visit.id}`,
    undefined,
    403,
  );
  assert.equal(
    (await call(session.token, "/api/visits")).some(
      (v) => v.id === confirmed.visit.id,
    ),
    false,
  );
  fixtureSql(
    `UPDATE Visits SET ClinicLocationId='${target.id}' WHERE Id='${confirmed.visit.id}';`,
  );
});
