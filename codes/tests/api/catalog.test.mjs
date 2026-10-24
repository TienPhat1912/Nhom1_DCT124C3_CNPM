import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fixtureSql } from "./sql-fixture.mjs";
const base = process.env.API_URL;
assert.match(process.env.ACCEPTANCE_DB ?? "", /^HospitalAcceptance_\d+$/);
assert.ok(base && process.env.DEMO_PASSWORD);
const source = JSON.parse(readFileSync(new URL("../../packages/shared/data/hospital-roster.json", import.meta.url), "utf8"));
const maps = JSON.parse(readFileSync(new URL("../../packages/shared/data/hospital-departments.json", import.meta.url), "utf8"));
async function call(path, body, token, expected=200) {
  const response = await fetch(base+path, {method:body===undefined?"GET":"POST", headers:{"Content-Type":"application/json","X-Hospital-Client":"1","X-Client":"native","Idempotency-Key":randomUUID(),...(token?{Authorization:"Bearer "+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  assert.equal(response.status,expected,JSON.stringify({path,status:response.status,data}));
  return data;
}
const config=await call("/api/config");
const directory=await call("/api/directory");
assert.equal(directory.departments.length,50);
assert.equal(directory.clinicians.length,256);
assert.equal(directory.clinicians.filter(d=>d.isDoctor).length,253);
assert.equal(directory.clinics.length,81);
assert.equal(directory.specialties.length,53);
assert.equal(new Set(directory.clinicians.map(d=>d.id)).size,256);
for(const dep of directory.departments) {
  assert.equal(config.departments.find(d=>d.id===dep.id)?.code, maps.find(d=>d.id===dep.mapKey).code);
}
assert.equal(config.locations.find(l=>l.room==="B201").nameVi,"Catalog preservation sentinel");
assert.equal(config.locations.filter(l=>l.building==="?" && l.floor==="?").length,81);
assert.ok(directory.clinicians.every(d=>d.directoryOnly));
const reception=(await call("/api/auth/login",{email:"reception@demo.local",password:process.env.DEMO_PASSWORD})).token;
const admin=(await call("/api/auth/login",{email:"admin@demo.local",password:process.env.DEMO_PASSWORD})).token;
await call("/api/auth/login",{email:"doctor@demo.local",password:process.env.DEMO_PASSWORD});
const resources=await call("/api/reception/resources",undefined,reception);
const management=await call("/api/admin/configuration",undefined,admin);
for(const d of source.clinicians.filter(d=>d.isDoctor)) {
  assert.ok(resources.doctors.some(x=>x.id===d.id));
  assert.ok(management.staff.some(x=>x.id===d.id && x.directoryOnly));
}
assert.ok(source.clinicians.filter(d=>!d.isDoctor).every(d=>!resources.doctors.some(x=>x.id===d.id)));
const doctor=source.clinicians.find(d=>d.departmentKey==="C-neurosurgery");
const dep=directory.departments.find(d=>d.mapKey===doctor.departmentKey);
const storedDoctor=management.staff.find(d=>d.id===doctor.id);
await call("/api/auth/login",{email:storedDoctor.email,password:process.env.DEMO_PASSWORD},undefined,401);
const guest=await call("/api/auth/guest",{language:"vi"});
const request=await call("/api/requests",{name:"Catalog isolated test",contact:"test-contact",description:"",requests:"",departmentId:config.departments.find(d=>d.code==="CONSULT").id},guest.token);
const input={version:1,departmentId:dep.id,locationId:doctor.clinicIds[0],doctorId:doctor.id,attendeeVerified:true,verificationNote:"Verified in isolated catalog test"};
const foreignClinic=source.clinics.find(c=>c.departmentKey==="D-paediatrics");
await call("/api/requests/"+request.id+"/confirm",{...input,locationId:foreignClinic.id},reception,422);
const created=await call("/api/requests/"+request.id+"/confirm",input,reception);
const visit=await call("/api/visits/"+created.visitId,undefined,reception);
assert.equal(visit.doctorId,doctor.id);
assert.equal(visit.departmentId,dep.id);
assert.equal(visit.steps[0].destination.building,"?");
assert.equal(visit.steps[0].destination.floor,"?");
// Provision only a synthetic test login in the isolated DB, then open the doctor workspace.
await call("/api/admin/staff", {id:doctor.id,version:storedDoctor.version,email:"catalog-doctor@example.invalid",name:doctor.name,role:"Doctor",departmentIds:[dep.id],active:true,password:process.env.DEMO_PASSWORD},admin);
const doctorSession=await call("/api/auth/login",{email:"catalog-doctor@example.invalid",password:process.env.DEMO_PASSWORD});
const profile=await call("/api/staff/profile",undefined,doctorSession.token);
assert.equal(profile.departments[0].id,dep.id);
assert.ok(profile.specialties.includes("Ngoại thần kinh"));
assert.ok(profile.clinics.some(c=>c.id===doctor.clinicIds[0]));
const assigned=await call("/api/visits",undefined,doctorSession.token);
assert.ok(assigned.some(v=>v.id===created.visitId));
const doctorVisit=await call("/api/visits/"+created.visitId,undefined,doctorSession.token);
assert.equal(doctorVisit.doctorName,doctor.name);
assert.equal(doctorVisit.departmentNameVi,dep.nameVi);
const ticket=await call("/api/visits/"+created.visitId+"/ticket",undefined,reception);
assert.equal(ticket.doctorName,doctor.name);
assert.equal(ticket.departmentNameVi,dep.nameVi);
// Same department, different clinic: enforce membership on the server too.
const paired=source.clinicians.find(d=>d.isDoctor && source.clinics.some(c=>c.departmentKey===d.departmentKey&&!d.clinicIds.includes(c.id)));
const pairedDep=directory.departments.find(d=>d.mapKey===paired.departmentKey);
const wrong=source.clinics.find(c=>c.departmentKey===paired.departmentKey&&!paired.clinicIds.includes(c.id));
const guest2=await call("/api/auth/guest",{language:"vi"});
const request2=await call("/api/requests",{name:"Wrong clinic test",contact:"test-contact",description:"",requests:"",departmentId:config.departments.find(d=>d.code==="CONSULT").id},guest2.token);
await call("/api/requests/"+request2.id+"/confirm",{...input,departmentId:pairedDep.id,doctorId:paired.id,locationId:wrong.id},reception,422);
const marker=fixtureSql("SET NOCOUNT ON; SELECT COUNT(*) FROM AuditEvent WHERE Source='Catalog';").trim();
assert.equal(Number(marker.split(/\r?\n/).find(line => /^\s*\d+\s*$/.test(line))),1);
console.log("PASS catalog import into existing DB, source counts, preserved configuration/login, reception scope, CN separation, no generated login, correct assignment and wrong clinic rejection");
