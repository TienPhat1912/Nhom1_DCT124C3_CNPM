"""Read legacy SQL Server data through sqlcmd; never invoke application startup."""
import argparse
import collections
import json
from pathlib import Path
import subprocess
import sys
import uuid


def parse_report(output):
    rows = []
    for line in output.splitlines():
        if not line.strip():
            continue
        rule, entity, related, count = [part.strip() for part in line.split('|')]
        if not rule.replace('_', '').isalpha():
            raise ValueError('Invalid rule')
        rows.append(dict(rule=rule, entityId=str(uuid.UUID(entity)),
                         relatedId=None if related == '-' else str(uuid.UUID(related)),
                         recordCount=int(count)))
    counts = collections.Counter(row['rule'] for row in rows)
    return dict(schema='legacy-v1', findings=rows, findingRowsByRule=dict(sorted(counts.items())),
                totalFindingRows=len(rows))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', required=True)
    parser.add_argument('--database', required=True)
    parser.add_argument('--user', help='SQL login; supply password through SQLCMDPASSWORD, never CLI')
    parser.add_argument('--trust-server-certificate', action='store_true')
    args = parser.parse_args()
    if not args.server.strip() or not args.database.strip():
        parser.error('Explicit nonempty server and database are required')
    command = ['sqlcmd', '-S', args.server, '-d', args.database, '-b', '-l', '15',
               '-t', '60', '-h', '-1', '-W', '-s', '|', '-w', '65535', '-X',
               '-i', str(Path(__file__).with_suffix('.sql'))]
    command += ['-U', args.user] if args.user else ['-E']
    if args.trust_server_certificate:
        command.append('-C')
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=90, check=True)
        report = parse_report(result.stdout)
    except (OSError, subprocess.SubprocessError, ValueError):
        # sqlcmd errors can contain endpoint/login or data; deliberately do not echo them.
        print('Audit failed: check connection, SELECT permissions and legacy schema. No report produced.', file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
