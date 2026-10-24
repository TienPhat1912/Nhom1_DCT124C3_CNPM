import { fixtureSql } from "./sql-fixture.mjs";
fixtureSql("UPDATE Location SET NameVi=N'Catalog preservation sentinel' WHERE Room='B201';");
console.log("Prepared existing database sentinel.");
