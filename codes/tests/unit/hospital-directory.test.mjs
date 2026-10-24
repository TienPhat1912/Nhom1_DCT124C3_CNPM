import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  directoryResults,
  compatibleDoctors,
} from "../../packages/shared/src/directory.ts";
import { mapDepartments } from "../../packages/shared/src/hospitalDepartments.ts";
const roster = JSON.parse(
  readFileSync(
    new URL("../../packages/shared/data/hospital-roster.json", import.meta.url),
    "utf8",
  ),
);
const directory = {
  ...roster,
  departments: mapDepartments,
  specialties: roster.specialties.map((s) => ({
    ...s,
    departmentId: s.departmentKey,
  })),
  clinics: roster.clinics.map((c) => ({ ...c, departmentId: c.departmentKey })),
  clinicians: roster.clinicians.map((d) => ({
    ...d,
    departmentId: d.departmentKey,
  })),
};
test("source preserves distinct identities, merged clinics, CN qualifications, missing room numbers and source cells", () => {
  assert.equal(roster.clinicians.length, 256);
  assert.equal(roster.clinicians.filter((d) => !d.isDoctor).length, 3);
  assert.equal(roster.clinics.length, 81);
  assert.equal(new Set(roster.clinicians.map((d) => d.id)).size, 256);
  for (const d of roster.clinicians) {
    assert.ok(mapDepartments.some((p) => p.id === d.departmentKey));
    assert.ok(
      d.clinicIds.every((id) =>
        roster.clinics.some(
          (c) => c.id === id && c.departmentKey === d.departmentKey,
        ),
      ),
    );
    assert.ok(
      d.specialtyIds.every((id) =>
        roster.specialties.some(
          (s) => s.id === id && s.departmentKey === d.departmentKey,
        ),
      ),
    );
    assert.ok(d.sourceVariants.every((v) => /^[F-L]\d+$/.test(v.cell)));
    assert.ok(!/nghỉ|bs\.|tham vấn/i.test(d.name));
  }
  assert.equal(directoryResults(directory, "kieu minh rin").length, 1);
  assert.equal(directoryResults(directory, "", "C-neurosurgery").length, 3);
  const ab = roster.clinicians.filter(
    (d) =>
      d.departmentKey === "G-cardiology" && /Nguyễn Hồng Phúc/.test(d.name),
  );
  assert.equal(ab.length, 2);
  assert.notEqual(ab[0].id, ab[1].id);
  assert.equal(
    roster.clinicians.filter(
      (d) => d.name === "Vương Đình Khoa" || d.name === "Lương Quang Thịnh",
    ).length,
    2,
  );
  assert.equal(
    roster.clinicians.filter(
      (d) =>
        d.name === "Nguyễn Hoàng Khánh" || d.name === "Trần Phan Minh Triết",
    ).length,
    2,
  );
  assert.ok(roster.clinics.some((c) => c.room === null));
  assert.ok(roster.warnings.some((w) => w.kind === "dateMismatch"));
});
test("clinic selection rejects another department and incompatible clinic", () => {
  const d = roster.clinicians.find(
    (d) => d.departmentKey === "D-paediatrics" && d.clinicIds.length === 1,
  );
  const doctors = [
    {
      id: d.id,
      departments: [d.departmentKey],
      clinicIds: d.clinicIds,
      name: d.name,
    },
  ];
  assert.equal(
    compatibleDoctors(doctors, d.departmentKey, d.clinicIds[0]).length,
    1,
  );
  assert.equal(
    compatibleDoctors(doctors, "B-internal", d.clinicIds[0]).length,
    0,
  );
  assert.equal(
    compatibleDoctors(doctors, d.departmentKey, "unknown-clinic").length,
    0,
  );
});

test("administrator labels and disabled departments propagate to map and checkpoint choices", async () => {
  const { configuredHospitalMap, startNodes, shortestPath } =
    await import("../../packages/shared/src/hospitalMap.ts");
  const dep = {
    id: "database-neuro",
    code: "C-NEUROSURGERY",
    nameVi: "Tên khoa đã cập nhật",
    nameEn: "Updated department",
    active: true,
  };
  const graph = configuredHospitalMap([dep], true);
  const target = graph.nodes.find((n) => n.departmentId === "C-neurosurgery");
  assert.equal(target.nameVi, dep.nameVi);
  assert.ok(startNodes("C", "4", graph).some((n) => n.id === target.id));
  const closed = configuredHospitalMap([{ ...dep, active: false }], true);
  assert.ok(!startNodes("C", "4", closed).some((n) => n.id === target.id));
  assert.equal(shortestPath(closed, "gate-1", target.id), null);
});
