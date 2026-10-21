import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
export function fixtureSql(query) {
  const database = process.env.ACCEPTANCE_DB ?? '';
  assert.match(database, /^HospitalAcceptance_\d+$/, 'Fixture changes require an isolated acceptance database');
  const prefix = process.env.SQL_CONTAINER_NAME ? ['exec', '-i', process.env.SQL_CONTAINER_NAME] : ['compose', 'exec', '-T', 'sql'];
  return execFileSync('docker', [...prefix, 'sh', '-c', 'exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d "$1" -Q "$2" -b', 'fixture', database, query], { encoding: 'utf8' });
}
