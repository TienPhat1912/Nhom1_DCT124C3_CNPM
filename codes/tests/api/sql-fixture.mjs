import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
export function fixtureSql(query) {
  const database = process.env.ACCEPTANCE_DB ?? '';
  assert.match(database, /^HospitalAcceptance_\d+$/, 'Fixture changes require an isolated acceptance database');
  if (process.env.SQL_TEST_SERVER) {
    // Windows CI uses its own LocalDB instance and Windows authentication.
    // Never take this endpoint from the production connection string.
    const server = process.env.SQL_TEST_SERVER;
    assert.match(server, /^(\(localdb\)\\[\w-]+|\.\\[\w-]+)$/, 'Native fixtures require a local SQL instance');
    return execFileSync(process.env.SQLCMD_PATH || 'sqlcmd', ['-I', '-S', server, '-E', '-C', '-d', database, '-Q', query, '-b', '-l', '15'], { encoding: 'utf8' });
  }
  const prefix = process.env.SQL_CONTAINER_NAME ? ['exec', '-i', process.env.SQL_CONTAINER_NAME] : ['compose', 'exec', '-T', 'sql'];
  // Filtered indexes require QUOTED_IDENTIFIER ON even for fixture UPDATEs.
  return execFileSync('docker', [...prefix, 'sh', '-c', 'exec /opt/mssql-tools18/bin/sqlcmd -I -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -d "$1" -Q "$2" -b', 'fixture', database, query], { encoding: 'utf8' });
}
