import assert from "node:assert/strict";
import {fixtureSql} from "./sql-fixture.mjs";
const counts=fixtureSql("SET NOCOUNT ON; SELECT COUNT(*) FROM Department; SELECT COUNT(*) FROM Users; SELECT COUNT(*) FROM Location; SELECT COUNT(*) FROM AuditEvent WHERE Source='Catalog'; SELECT COUNT(*) FROM Visits;").split(/\r?\n/).filter(line=>/^\s*\d+\s*$/.test(line)).map(Number);
assert.deepEqual(counts,[54,260,88,1,1]);
console.log("PASS repeated import: no duplicate departments, accounts or locations; existing visit preserved.");
