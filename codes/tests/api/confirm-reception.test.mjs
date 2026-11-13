import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";

const base = process.env.API_URL,
  password = process.env.DEMO_PASSWORD;
assert.ok(
  base && password && process.env.ACCEPTANCE_DB,
  "Use an isolated acceptance API/database",
);
let reception, second, clinic, config;
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
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
  return result;
}
function scalar(sql) {
  return Number(
    fixtureSql(`SET NOCOUNT ON; SELECT (${sql}) AS Value;`)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => /^\d+$/.test(s)),
  );
}
async function request(guest = false) {
  const session = guest
    ? await call(null, "/api/auth/guest", { language: "en" })
    : await call(null, "/api/auth/register", {
        email: `${randomUUID()}@example.test`,
        password,
        name: "PB008 Original",
        contact: "test-contact",
        language: "en",
      });
  if (guest)
    await call(
      session.token,
      "/api/auth/profile",
      {
        name: "PB008 Guest Original",
        contact: "test-contact",
        language: "en",
        version: 1,
      },
      200,
      randomUUID(),
      "PUT",
    );
  const row = await call(
    session.token,
    "/api/v2/requests",
    {
      contact: "frozen-contact",
      preferredDepartmentId: null,
      description: "  original description\n",
      sourceLanguage: "en",
    },
    201,
  );
  return {
    session,
    row,
    input: {
      version: row.version,
      clinicLocationId: clinic.clinicLocationId,
      clinicAssignmentVersion: clinic.version,
      attendeeVerified: true,
      verificationNote: "Verified fixture attendee",
    },
  };
}
before(async () => {
  config = await call(null, "/api/config");
  assert.equal(config.prdV2Enabled, true);
  reception = await call(null, "/api/auth/login", {
    email: "reception@demo.local",
    password,
  });
  const id = randomUUID(),
    email = `${id}@example.test`;
  fixtureSql(`INSERT Users (Id,Version,CreatedAt,Email,PasswordHash,Name,Role,Active) SELECT '${id}',1,SYSUTCDATETIME(),'${email}',PasswordHash,N'PB008 second reception','Reception',1 FROM Users WHERE Email='reception@demo.local';
    INSERT StaffScope (Id,Version,CreatedAt,UserAccountId,DepartmentId) SELECT NEWID(),1,SYSUTCDATETIME(),'${id}',DepartmentId FROM StaffScope WHERE UserAccountId=(SELECT Id FROM Users WHERE Email='reception@demo.local');`);
  second = {
    ...(await call(null, "/api/auth/login", { email, password })),
    userId: id,
  };
  const rooms = await call(reception.token, "/api/v2/reception/clinics");
  clinic = rooms.find((c) => c.room === "A101");
  assert.ok(clinic);
});

for (const guest of [false, true])
  test(`two staff race, replay, ${guest ? "Guest grant" : "Account access"}, immutable ticket and no QR`, async () => {
    const { session, row, input } = await request(guest);
    const key = randomUUID();
    const url = `/api/v2/requests/${row.id}/confirm`;
    const responses = await Promise.all([
      call(reception.token, url, input, 200, key),
      call(second.token, url, input),
    ]);
    const result = responses[0];
    assert.equal(responses[1].visit.id, result.visit.id);
    assert.equal(result.visit.status, "Active");
    assert.equal(result.visit.journeyStatus, "Active");
    assert.equal(result.visit.examStatus, "Waiting");
    assert.equal(result.visit.consultationCount, 0);
    assert.equal(result.ticket.clinicLocationId, clinic.clinicLocationId);
    assert.equal(result.ticket.doctorSnapshot.id, clinic.activeDoctor.id);
    assert.equal(result.ticket.patientSnapshot.contact, "frozen-contact");
    assert.equal(result.request.canConfirm, false);
    assert.deepEqual(await call(reception.token, url, input, 200, key), result);
    assert.equal(
      (
        await call(
          reception.token,
          url,
          { ...input, verificationNote: "changed note" },
          409,
          key,
        )
      ).title,
      "idempotencyConflict",
    );
    const visit = await call(session.token, `/api/visits/${result.visit.id}`);
    assert.equal(visit.journeyStatus, "Active");
    assert.ok(visit.currentStepId);
    assert.equal(
      scalar(
        `SELECT COUNT(*) FROM Visits WHERE ReceptionRecordId IN (SELECT Id FROM ReceptionRecord WHERE RegistrationRequestId='${row.id}')`,
      ),
      1,
    );
    assert.equal(
      scalar(
        `SELECT COUNT(*) FROM ExaminationTicket WHERE VisitId='${result.visit.id}'`,
      ),
      1,
    );
    assert.equal(
      scalar(
        `SELECT COUNT(*) FROM AccessGrant WHERE VisitId='${result.visit.id}'`,
      ),
      guest ? 1 : 0,
    );
    assert.equal(
      scalar(
        `SELECT COUNT(*) FROM QrCode WHERE ExaminationTicketId='${result.ticket.id}' OR RegistrationRequestId='${row.id}'`,
      ),
      0,
    );
    const ticket = await call(
      session.token,
      `/api/visits/${result.visit.id}/ticket`,
    );
    fixtureSql(
      `UPDATE Patients SET Name=N'Changed profile' WHERE Id='${session.patientId}';`,
    );
    assert.deepEqual(
      await call(reception.token, `/api/visits/${result.visit.id}/ticket`),
      ticket,
    );
    await call(reception.token, `/api/visits/${result.visit.id}/reissue`, {
      attendeeVerified: true,
      verificationNote: "Reprint verified",
    });
    assert.deepEqual(
      await call(session.token, `/api/visits/${result.visit.id}/ticket`),
      ticket,
    );
    const stranger = await call(null, "/api/auth/guest", { language: "en" });
    await call(
      stranger.token,
      `/api/visits/${result.visit.id}/ticket`,
      undefined,
      403,
    );
    if (guest) {
      const token = randomUUID(),
        hash = createHash("sha256").update(token).digest("hex").toUpperCase();
      fixtureSql(
        `INSERT Sessions (Id,Version,CreatedAt,PatientId,TokenHash,IsGuest,ExpiresAt,Revoked) VALUES (NEWID(),1,SYSUTCDATETIME(),'${session.patientId}','${hash}',1,DATEADD(hour,1,SYSUTCDATETIME()),0);`,
      );
      await call(token, `/api/visits/${result.visit.id}`, undefined, 403);
    }
    assert.equal((await call(session.token, "/api/entry")).createsVisit, false);
  });

test("failed setup after allocation rolls back ticket counter, request, visit, audit, grant and receipt", async () => {
  const { row, input } = await request(true);
  const tables = [
    "Visits",
    "ExaminationTicket",
    "PatientJourney",
    "ReceptionRecord",
    "AccessGrant",
    "CommandReceipt",
    "AuditEvent",
    "Notification",
  ];
  const before = tables.map((t) => scalar(`SELECT COUNT(*) FROM ${t}`));
  const count = scalar(
    "SELECT COALESCE(SUM(LastNumber),0) FROM TicketDailyCounters",
  );
  const cashier = config.departments.find((d) => d.code === "CASHIER").id;
  const active = config.locations
    .filter((l) => l.departmentId === cashier)
    .map((l) => `'${l.id}'`)
    .join(",");
  const key = randomUUID();
  try {
    fixtureSql(`UPDATE Location SET Active=0 WHERE Id IN (${active});`);
    assert.equal(
      (
        await call(
          reception.token,
          `/api/v2/requests/${row.id}/confirm`,
          input,
          409,
          key,
        )
      ).title,
      "destinationInvalid",
    );
    assert.deepEqual(
      tables.map((t) => scalar(`SELECT COUNT(*) FROM ${t}`)),
      before,
    );
    assert.equal(
      scalar("SELECT COALESCE(SUM(LastNumber),0) FROM TicketDailyCounters"),
      count,
    );
    assert.equal(
      (await call(reception.token, `/api/v2/requests/${row.id}`)).status,
      "Submitted",
    );
  } finally {
    fixtureSql(`UPDATE Location SET Active=1 WHERE Id IN (${active});`);
  }
  await call(
    reception.token,
    `/api/v2/requests/${row.id}/confirm`,
    input,
    200,
    key,
  );
  assert.equal(
    scalar("SELECT COALESCE(SUM(LastNumber),0) FROM TicketDailyCounters"),
    count + 1,
  );
});

test("authorization, strict payload, stale versions, disabled doctor, scope and withdrawal guards", async () => {
  const { session, row, input } = await request();
  const url = `/api/v2/requests/${row.id}/confirm`;
  await call(session.token, url, input, 403);
  await call(session.token, `/api/requests/${row.id}/refresh-qr`, {}, 410);
  await call(reception.token, url, { ...input, doctorId: randomUUID() }, 422);
  await call(reception.token, url, { ...input, version: row.version + 1 }, 409);
  await call(
    reception.token,
    url,
    { ...input, clinicAssignmentVersion: clinic.version + 1 },
    409,
  );
  await call(reception.token, url, { ...input, attendeeVerified: false }, 422);
  await call(reception.token, url, { ...input, verificationNote: "" }, 422);
  await call(
    reception.token,
    url,
    { ...input, clinicLocationId: randomUUID() },
    409,
  );
  try {
    fixtureSql(
      `UPDATE Users SET Active=0 WHERE Id='${clinic.activeDoctor.id}';`,
    );
    assert.equal(
      (await call(reception.token, url, input, 409)).title,
      "doctorUnavailable",
    );
    assert.ok(
      !(await call(reception.token, "/api/v2/reception/clinics")).some(
        (c) => c.clinicLocationId === clinic.clinicLocationId,
      ),
    );
  } finally {
    fixtureSql(
      `UPDATE Users SET Active=1 WHERE Id='${clinic.activeDoctor.id}';`,
    );
  }
  const department = config.locations.find(
    (l) => l.id === clinic.clinicLocationId,
  ).departmentId;
  try {
    fixtureSql(
      `DELETE StaffScope WHERE UserAccountId='${second.userId}' AND DepartmentId='${department}';`,
    );
    await call(second.token, url, input, 403);
  } finally {
    fixtureSql(
      `IF NOT EXISTS (SELECT 1 FROM StaffScope WHERE UserAccountId='${second.userId}' AND DepartmentId='${department}') INSERT StaffScope (Id,Version,CreatedAt,UserAccountId,DepartmentId) VALUES (NEWID(),1,SYSUTCDATETIME(),'${second.userId}','${department}');`,
    );
  }
  await call(session.token, `/api/requests/${row.id}/withdraw`, {});
  const withdrawn = await call(reception.token, `/api/v2/requests/${row.id}`);
  await call(
    reception.token,
    url,
    { ...input, version: withdrawn.version },
    409,
  );
});

test("occupied clinic accepts another waiting patient; distinct patients get consecutive tickets", async () => {
  const first = await request(),
    secondRequest = await request();
  const one = await call(
    reception.token,
    `/api/v2/requests/${first.row.id}/confirm`,
    first.input,
  );
  fixtureSql(
    `UPDATE Visits SET ExamStatus='InConsultation',ConsultationCount=1 WHERE Id='${one.visit.id}';`,
  );
  const two = await call(
    reception.token,
    `/api/v2/requests/${secondRequest.row.id}/confirm`,
    secondRequest.input,
  );
  assert.equal(two.visit.examStatus, "Waiting");
  assert.equal(two.ticket.sequenceNumber, one.ticket.sequenceNumber + 1);
  assert.equal(
    (await call(first.session.token, `/api/visits/${one.visit.id}`)).examStatus,
    "InConsultation",
  );
});

test("confirmation rechecks active Visits and pending requests even when legacy data conflicts", async () => {
  for (const activeVisit of [false, true]) {
    const { session, row, input } = await request();
    fixtureSql(`UPDATE Requests SET Status='Withdrawn' WHERE Id='${row.id}';`);
    const departmentId = config.departments.find(
      (d) => d.code === "CONSULT",
    ).id;
    const legacy = await call(session.token, "/api/requests", {
      name: "Legacy conflict",
      contact: "test-contact",
      description: "",
      requests: "",
      departmentId,
    });
    if (activeVisit)
      await call(reception.token, `/api/requests/${legacy.id}/confirm`, {
        version: 1,
        departmentId,
        locationId: clinic.clinicLocationId,
        attendeeVerified: true,
        verificationNote: "Verified legacy fixture",
      });
    fixtureSql(`UPDATE Requests SET Status='Submitted' WHERE Id='${row.id}';`);
    const count = scalar(
      "SELECT COALESCE(SUM(LastNumber),0) FROM TicketDailyCounters",
    );
    assert.equal(
      (
        await call(
          reception.token,
          `/api/v2/requests/${row.id}/confirm`,
          input,
          409,
        )
      ).title,
      activeVisit ? "activeVisitExists" : "pendingRequestExists",
    );
    assert.equal(
      scalar("SELECT COALESCE(SUM(LastNumber),0) FROM TicketDailyCounters"),
      count,
    );
  }
});

test("replay cannot leak a confirmed ticket after target department scope is removed", async () => {
  const { row, input } = await request();
  const target = (
    await call(reception.token, "/api/v2/reception/clinics")
  ).find((c) => c.room === "D301");
  const key = randomUUID(),
    url = `/api/v2/requests/${row.id}/confirm`;
  const body = {
    ...input,
    clinicLocationId: target.clinicLocationId,
    clinicAssignmentVersion: target.version,
  };
  const result = await call(second.token, url, body, 200, key);
  try {
    fixtureSql(
      `DELETE StaffScope WHERE UserAccountId='${second.userId}' AND DepartmentId='${result.visit.departmentId}';`,
    );
    await call(second.token, url, body, 403, key);
    await call(second.token, url, body, 403);
    await call(
      second.token,
      `/api/visits/${result.visit.id}/ticket`,
      undefined,
      403,
    );
  } finally {
    fixtureSql(
      `INSERT StaffScope (Id,Version,CreatedAt,UserAccountId,DepartmentId) VALUES (NEWID(),1,SYSUTCDATETIME(),'${second.userId}','${result.visit.departmentId}');`,
    );
  }
});
