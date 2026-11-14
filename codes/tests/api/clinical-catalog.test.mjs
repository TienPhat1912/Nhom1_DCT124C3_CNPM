import { before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL, password = process.env.DEMO_PASSWORD;
assert.ok(base && password && process.env.ACCEPTANCE_DB, "Use an isolated acceptance database/API");
let admin, doctor, reception, service, cashier, patient;
const adminPath = kind => `/api/v2/admin/clinical-catalog/${kind}`;
const doctorPath = kind => `/api/v2/clinical-catalog/${kind}`;
const code = () => "PB013_" + randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase();
const body = (patch = {}) => ({ version: 0, code: code(), nameVi: "Mục danh mục tổng hợp", active: true, ...patch });
const templateBody = (patch = {}) => body({ language: "vi", diagnosisTemplate: "Chẩn đoán: {{diagnoses}}", explanationTemplate: "{{symptoms}}; {{signs}}", instructionsTemplate: "Hướng dẫn mẫu tổng hợp", ...patch });
const input = item => ({ version: item.version, code: item.code, nameVi: item.nameVi, active: item.active,
  ...(item.kind === "Template" ? { language: item.language, diagnosisTemplate: item.diagnosisTemplate, explanationTemplate: item.explanationTemplate, instructionsTemplate: item.instructionsTemplate } : {}) });
async function call(token, path, data, expected = 200, key = randomUUID(), method = data === undefined ? "GET" : "POST") {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", "X-Client": "native", "Idempotency-Key": key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const value = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(value)}`); return value;
}
const update = (kind, item, patch = {}, expected = 200, key = randomUUID()) => call(admin.token, `${adminPath(kind)}/${item.id}`, { ...input(item), ...patch }, expected, key, "PUT");
// sqlcmd on Windows uses native argument parsing; hex avoids nested JSON quotes.
const sqlText = value => `CONVERT(nvarchar(max),0x${Buffer.from(value, "utf16le").toString("hex")})`;
before(async () => {
  const login = name => call(null, "/api/auth/login", { email: `${name}@demo.local`, password });
  admin = await login("admin"); doctor = await login("doctor"); reception = await login("reception"); service = await login("service"); cashier = await login("cashier"); patient = await login("patient");
});
test("roles and active-only reads for all four catalogs; fixtures are explicitly demo", async () => {
  await call(null, adminPath("symptoms"), undefined, 401);
  for (const kind of ["symptoms", "signs", "diagnoses", "templates"]) {
    const initial = await call(doctor.token, doctorPath(kind)); assert.ok(initial.items.some(x => x.isDemo));
    for (const role of [doctor, reception, service, cashier, patient]) {
      await call(role.token, adminPath(kind), undefined, 403);
      await call(role.token, adminPath(kind), kind === "templates" ? templateBody() : body(), 403);
    }
    for (const role of [admin, reception, service, cashier, patient]) await call(role.token, doctorPath(kind), undefined, 403);
    const value = kind === "templates" ? templateBody({ active: false }) : body({ active: false });
    const created = await call(admin.token, adminPath(kind), value);
    assert.equal(created.isDemo, false); assert.equal(created.version, 1); assert.match(created.createdAt, /Z$/);
    assert.ok(!(await call(doctor.token, `${doctorPath(kind)}?search=${created.code}`)).items.length);
    const enabled = await update(kind, created, { active: true }); assert.equal(enabled.version, 2);
    assert.deepEqual((await call(doctor.token, `${doctorPath(kind)}?search=${created.code}`)).items[0], enabled);
    const renamed = await update(kind, enabled, { nameVi: "Tên mới tổng hợp" }); assert.equal(renamed.version, 3);
    const disabled = await update(kind, renamed, { active: false }); assert.equal(disabled.version, 4);
    assert.equal((await call(doctor.token, `${doctorPath(kind)}?search=${created.code}`)).items.length, 0);
    assert.equal((await call(admin.token, `${adminPath(kind)}?search=${created.code}`)).items[0].active, false);
  }
});
test("strict fields, code and version validation; stable code and kind cannot be rewritten", async () => {
  for (const patch of [{ version: 1 }, { version: "0" }, { code: "BAD CODE" }, { code: "1BAD" }, { code: "A" }, { code: "ĐƠN" }, { code: "X".repeat(41) }, { nameVi: " " }, { nameVi: "X".repeat(201) }, { active: "true" }, { isDemo: true }, { kind: "Diagnosis" }])
    await call(admin.token, adminPath("symptoms"), body(patch), 422);
  for (const invalid of [null, [], {}, { version: 0 }]) await call(admin.token, adminPath("symptoms"), invalid, 422);
  const created = await call(admin.token, adminPath("symptoms"), body({ code: "  " + code().toLowerCase() + "  " }));
  assert.equal(created.code, created.code.trim().toUpperCase());
  await update("symptoms", created, { code: code() }, 409);
  await update("symptoms", created, { version: 0 }, 422);
  await update("symptoms", created, { version: 99 }, 409);
  await update("signs", created, {}, 404);
  await call(admin.token, `${adminPath("symptoms")}/${randomUUID()}`, input(created), 404, randomUUID(), "PUT");
  await call(admin.token, adminPath("unknown"), undefined, 404);
  await call(doctor.token, doctorPath("unknown"), undefined, 404);
  await call(admin.token, `${adminPath("symptoms")}?offset=-1`, undefined, 422);
  await call(doctor.token, `${doctorPath("symptoms")}?search=${"A".repeat(101)}`, undefined, 422);
  const demo = (await call(admin.token, `${adminPath("signs")}?search=DEMO_SIGN_01`)).items[0];
  const edited = await update("signs", demo, { nameVi: "Dấu hiệu minh họa đã sửa" }); assert.equal(edited.isDemo, true);
});
test("Vietnamese templates validate source, supported placeholders and explicit diagnosis selection", async () => {
  for (const patch of [{ language: "en" }, { diagnosisTemplate: "Chẩn đoán tĩnh" }, { diagnosisTemplate: "{{symptoms}}" }, { explanationTemplate: "{{unknown}}" }, { instructionsTemplate: "{{diagnoses" }, { instructionsTemplate: " " }, { diagnosisTemplate: "{{diagnoses}}" + "X".repeat(4000) }, { explanationTemplate: null }, { published: true }])
    await call(admin.token, adminPath("templates"), templateBody(patch), 422);
  const value = await call(admin.token, adminPath("templates"), templateBody());
  assert.equal(value.language, "vi"); assert.equal(value.diagnosisTemplate, "Chẩn đoán: {{diagnoses}}");
  const changed = await update("templates", value, { instructionsTemplate: "Nội dung cấu hình mới" }); assert.equal(changed.version, 2);
  await update("templates", value, {}, 409);
});
test("concurrent duplicate codes, stale updates, idempotency and audit are atomic", async () => {
  const data = body(), key = randomUUID();
  const created = await call(admin.token, adminPath("diagnoses"), data, 200, key);
  const replay = await Promise.all(Array.from({ length: 5 }, () => call(admin.token, adminPath("diagnoses"), data, 200, key)));
  for (const value of replay) assert.deepEqual(value, created);
  await call(admin.token, adminPath("diagnoses"), { ...data, nameVi: "Different" }, 409, key);
  const edit = async nameVi => {
    const r = await fetch(base + `${adminPath("diagnoses")}/${created.id}`, { method: "PUT", headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", Authorization: `Bearer ${admin.token}`, "Idempotency-Key": randomUUID() }, body: JSON.stringify({ ...input(created), nameVi }) });
    return { status: r.status, value: await r.json() };
  };
  const responses = await Promise.all([edit("Winner one"), edit("Winner two")]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(responses.find(r => r.status === 200).value.version, 2);
  await call(admin.token, adminPath("diagnoses"), body({ code: data.code.toLowerCase() }), 409);
  const simultaneous = body();
  const send = async () => {
    const response = await fetch(base + adminPath("symptoms"), { method: "POST", headers: { "Content-Type": "application/json", "X-Hospital-Client": "1", Authorization: `Bearer ${admin.token}`, "Idempotency-Key": randomUUID() }, body: JSON.stringify(simultaneous) }); return response.status;
  };
  assert.deepEqual((await Promise.all([send(), send()])).sort(), [200, 409]);
  const audit = await call(admin.token, "/api/admin/audit");
  const entries = audit.filter(x => x.type.startsWith("ClinicalCatalog") && JSON.parse(x.detail).id === created.id);
  assert.equal(entries.length, 2); assert.equal(entries[0].source, "Admin");
  const change = JSON.parse(entries.find(x => x.type === "ClinicalCatalogUpdated").detail);
  assert.equal(change.before.version, 1); assert.equal(change.after.version, 2);
});
test("historical result snapshots and links survive renaming and retirement", async () => {
  const symptom = await call(admin.token, adminPath("symptoms"), body()), sign = await call(admin.token, adminPath("signs"), body());
  const diagnosis = await call(admin.token, adminPath("diagnoses"), body()), template = await call(admin.token, adminPath("templates"), templateBody());
  const account = await call(null, "/api/auth/register", { email: `${randomUUID()}@example.test`, password, name: "PB013 history synthetic", contact: "synthetic-contact", language: "en" });
  const request = await call(account.token, "/api/v2/requests", { contact: "synthetic-contact", description: "Original", sourceLanguage: "en", preferredDepartmentId: null }, 201);
  const clinic = (await call(reception.token, "/api/v2/reception/clinics")).find(c => c.room === "A101");
  const result = await call(reception.token, `/api/v2/requests/${request.id}/confirm`, { version: request.version, clinicLocationId: clinic.clinicLocationId, clinicAssignmentVersion: clinic.version, attendeeVerified: true, verificationNote: "Synthetic historical fixture" });
  const recordId = randomUUID();
  fixtureSql(`INSERT ClinicalRecord (Id,Version,CreatedAt,VisitId,AuthorId,AuthorName,TemplateId,TemplateVersion,TemplateSnapshot,Language,Diagnosis,Explanation,Instructions,ConfirmedAt,PublishedAt) VALUES ('${recordId}',1,SYSUTCDATETIME(),'${result.visit.id}','${result.visit.doctorId}',N'Original author','${template.id}',${template.version},${sqlText(JSON.stringify(template))},'vi',N'Original diagnosis',N'Original explanation',N'Original instructions',SYSUTCDATETIME(),SYSUTCDATETIME());
    INSERT ClinicalSymptom (Id,Version,CreatedAt,ClinicalRecordId,SymptomCatalogId,CatalogVersion,Kind,CodeSnapshot,NameViSnapshot,IsDemoSnapshot) VALUES ${[symptom, sign].map(x => `('${randomUUID()}',1,SYSUTCDATETIME(),'${recordId}','${x.id}',${x.version},'${x.kind}',${sqlText(x.code)},${sqlText(x.nameVi)},0)`).join(",")};
    INSERT ClinicalDiagnosis (Id,Version,CreatedAt,ClinicalRecordId,DiagnosisCatalogId,CatalogVersion,CodeSnapshot,NameViSnapshot,IsDemoSnapshot) VALUES ('${randomUUID()}',1,SYSUTCDATETIME(),'${recordId}','${diagnosis.id}',${diagnosis.version},${sqlText(diagnosis.code)},${sqlText(diagnosis.nameVi)},0)`);
  const hash = () => fixtureSql(`SET NOCOUNT ON; SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256', (SELECT * FROM ClinicalRecord WHERE Id='${recordId}' FOR JSON PATH,INCLUDE_NULL_VALUES)),2); SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256', (SELECT * FROM ClinicalSymptom WHERE ClinicalRecordId='${recordId}' ORDER BY Id FOR JSON PATH,INCLUDE_NULL_VALUES)),2); SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256', (SELECT * FROM ClinicalDiagnosis WHERE ClinicalRecordId='${recordId}' FOR JSON PATH,INCLUDE_NULL_VALUES)),2)`);
  const before = hash();
  for (const [kind, item] of [["symptoms", symptom], ["signs", sign], ["diagnoses", diagnosis], ["templates", template]]) await update(kind, item, { nameVi: "Danh mục đã đổi tên", active: false, ...(kind === "templates" ? { explanationTemplate: "Mẫu mới" } : {}) });
  assert.equal(hash(), before);
  assert.throws(() => fixtureSql(`DELETE DiagnosisCatalog WHERE Id='${diagnosis.id}'`), "Historical FK must prevent hard delete");
  const after = await call(doctor.token, `/api/v2/visits/${result.visit.id}`); assert.equal(after.examStatus, "Waiting", "Catalog configuration must not complete an examination");
});
test("pagination applies role filters before page boundaries and search does not infer diagnoses", async () => {
  const prefix = "PB013PAGE_" + randomUUID().slice(0, 8).toUpperCase();
  fixtureSql(`INSERT SymptomCatalog (Id,Version,CreatedAt,Code,NameVi,Kind,Active,IsDemo) VALUES ${Array.from({ length: 103 }, (_, i) => `('${randomUUID()}',1,SYSUTCDATETIME(),'${prefix}_${String(i).padStart(3, "0")}',N'Pagination synthetic','Symptom',${i === 0 ? 0 : 1},0)`).join(",")}`);
  const first = await call(admin.token, `${adminPath("symptoms")}?search=${prefix}`), second = await call(admin.token, `${adminPath("symptoms")}?search=${prefix}&offset=100`);
  assert.equal(first.items.length, 100); assert.equal(first.hasMore, true); assert.equal(second.items.length, 3); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.items, ...second.items].map(x => x.id)).size, 103);
  const doctorFirst = await call(doctor.token, `${doctorPath("symptoms")}?search=${prefix}`), doctorSecond = await call(doctor.token, `${doctorPath("symptoms")}?search=${prefix}&offset=100`);
  assert.equal(doctorFirst.items.length, 100); assert.equal(doctorSecond.items.length, 2); assert.ok(doctorFirst.items.every(x => x.active));
  assert.equal((await call(doctor.token, `${doctorPath("diagnoses")}?search=${prefix}`)).items.length, 0);
});
test("audit persistence failure rolls back catalog and receipt, then retry commits once", async () => {
  const data = body(), key = randomUUID();
  fixtureSql("CREATE TRIGGER PB013_FailAudit ON AuditEvent AFTER INSERT AS IF EXISTS(SELECT 1 FROM inserted WHERE Type='ClinicalCatalogCreated') THROW 51019, 'Synthetic catalog audit failure', 1;");
  try {
    await call(admin.token, adminPath("symptoms"), data, 500, key);
    assert.equal((await call(admin.token, `${adminPath("symptoms")}?search=${data.code}`)).items.length, 0);
    assert.match(fixtureSql(`SET NOCOUNT ON; SELECT COUNT(*) FROM CommandReceipt WHERE [Key]='${key}'`), /\b0\b/);
  } finally { fixtureSql("DROP TRIGGER PB013_FailAudit"); }
  const created = await call(admin.token, adminPath("symptoms"), data, 200, key);
  assert.deepEqual(await call(admin.token, adminPath("symptoms"), data, 200, key), created);
});
