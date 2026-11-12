"""Real SQL Server fixture tests. Creates a NEW isolated database, retains it for inspection."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import uuid

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('audit', ROOT / 'scripts/data/legacy-audit.py')
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)
SQL = (ROOT / 'scripts/data/legacy-audit.sql').read_text()


def uid(n):
    return str(uuid.UUID(int=n))


class AuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = os.environ.get('LEGACY_AUDIT_TEST_SERVER')
        if not cls.server:
            raise unittest.SkipTest('Set LEGACY_AUDIT_TEST_SERVER to a local SQL Server')
        if cls.server not in ('localhost', '.', r'(localdb)\MSSQLLocalDB'):
            raise ValueError('Fixtures require a local server')
        cls.database = 'HospitalLegacyAudit_' + uuid.uuid4().hex
        cls.sql('CREATE DATABASE [' + cls.database + ']', database='master')
        print('Fixture database retained: ' + cls.database)
        # Minimal legacy projection: no production or application database is touched.
        cls.tables = {
            'Patients': 'Language nvarchar(10)',
            'Users': 'Role nvarchar(30), Active bit',
            'Visits': 'PatientId uniqueidentifier, DoctorId uniqueidentifier, Status nvarchar(30), FinalSettlementRevision int, WorkRevision int, FinalSettlementOutcome nvarchar(30)',
            'Requests': 'PatientId uniqueidentifier, Status nvarchar(30)',
            'PatientJourney': 'VisitId uniqueidentifier, Status nvarchar(30)',
            'JourneyStep': 'PatientJourneyId uniqueidentifier, LocationId uniqueidentifier, Kind nvarchar(30), Status nvarchar(30), DestinationSnapshot nvarchar(max)',
            'DoctorOrder': 'VisitId uniqueidentifier, Status nvarchar(30)',
            'ExaminationTicket': 'VisitId uniqueidentifier, Number nvarchar(50)',
            'SummaryVersion': 'VisitId uniqueidentifier, Status nvarchar(30)',
            'FollowUpRecommendation': 'VisitId uniqueidentifier, Status nvarchar(30)',
            'AuditEvent': 'VisitId uniqueidentifier, Type nvarchar(30)',
        }
        cls.sql('\n'.join(f'CREATE TABLE dbo.[{name}] (Id uniqueidentifier PRIMARY KEY, {columns});'
                          for name, columns in cls.tables.items()) + "\nCREATE USER audit_reader WITHOUT LOGIN; GRANT SELECT TO audit_reader; DENY INSERT, UPDATE, DELETE TO audit_reader;")

    @classmethod
    def sql(cls, query, database=None):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False, encoding='utf-8') as file:
            file.write('SET NOCOUNT ON;\n' + query)
        try:
            result = subprocess.run(['sqlcmd', '-S', cls.server, '-E', '-C', '-d', database or cls.database,
                                     '-b', '-l', '10', '-h', '-1', '-W', '-s', '|', '-w', '65535', '-i', file.name],
                                    capture_output=True, text=True, timeout=90)
            if result.returncode:
                raise AssertionError('Fixture SQL failed: ' + result.stdout + result.stderr)
            return result.stdout
        finally:
            Path(file.name).unlink()

    def insert(self, table, n, **values):
        values = dict(Id=uid(n), **values)
        def literal(value):
            return 'NULL' if value is None else "N'" + str(value).replace("'", "''") + "'"
        self.sql(f"INSERT dbo.[{table}] ({','.join(values)}) VALUES ({','.join(map(literal, values.values()))})")

    def fingerprint(self):
        return self.sql('\n'.join(f"SELECT '{table}', COUNT_BIG(*), COALESCE(CHECKSUM_AGG(BINARY_CHECKSUM(*)),0) FROM dbo.[{table}];" for table in self.tables))

    def audit(self):
        before = self.fingerprint()
        report = AUDIT.parse_report(self.sql("EXECUTE AS USER = 'audit_reader';\n" + SQL + '\nREVERT;'))
        self.assertEqual(before, self.fingerprint(), 'Counts and row checksums must not change')
        return report

    def test_fixtures(self):
        # Clean nonempty pre-reception fixture. Every legacy Visit lacks new ticket snapshots.
        self.insert('Patients', 1, Language='vi')
        self.insert('Requests', 2, PatientId=uid(1), Status='Submitted')
        snapshot = json.dumps(dict(id=uid(99), nameVi='Room', building='A', floor='1', room='101'))
        self.assertEqual(self.audit()['totalFindingRows'], 0)
        self.insert('Users', 6, Role='Doctor', Active=1)
        for n in (10, 11):
            self.insert('Visits', n, PatientId=uid(1), DoctorId=uid(6), Status='Active', WorkRevision=2,
                        FinalSettlementRevision=1 if n == 10 else None)
            self.insert('PatientJourney', n + 10, VisitId=uid(n), Status='PendingActivation')
            self.insert('JourneyStep', n + 20, PatientJourneyId=uid(n + 10), LocationId=uid(99), Kind='Consultation', Status='InProgress', DestinationSnapshot=snapshot)
        # Terminal controls must not inflate open-order/pharmacy counts.
        self.insert('JourneyStep', 4, PatientJourneyId=uid(20), LocationId=uid(99), Kind='Pharmacy', Status='Completed', DestinationSnapshot=snapshot)
        self.insert('DoctorOrder', 5, VisitId=uid(10), Status='Resolved')
        self.insert('Requests', 40, PatientId=uid(1), Status='NeedsInformation')
        for n in (41, 42):
            self.insert('DoctorOrder', n, VisitId=uid(10), Status='Ordered')
        self.insert('JourneyStep', 43, PatientJourneyId=uid(20), LocationId=uid(98), Kind='ReturnConsultation', Status='Skipped', DestinationSnapshot='invalid secret health text')
        self.insert('JourneyStep', 44, PatientJourneyId=uid(20), LocationId=uid(99), Kind='Pharmacy', Status='Ready', DestinationSnapshot='{}')
        self.insert('DoctorOrder', 45, VisitId=uid(10), Status='Cancelled')
        self.insert('SummaryVersion', 46, VisitId=uid(10), Status='Published')
        self.insert('FollowUpRecommendation', 47, VisitId=uid(10), Status='Published')
        self.insert('AuditEvent', 48, VisitId=uid(10), Type='GuestLinked')
        self.insert('Patients', 49, Language='ko')
        self.insert('ExaminationTicket', 50, VisitId=uid(10), Number='')
        report = self.audit()
        expected = dict(patient_multiple_open_records=4, room_multiple_consultations=2,
                        visit_multiple_open_orders=2, doctor_room_unconfirmed=1,
                        doctor_multiple_observed_rooms=2, pending_activation=2,
                        settlement_requires_review=1, settlement_before_clinical_resolution=1,
                        skipped_cancelled_step=1, skipped_cancelled_order=1,
                        published_summary_requires_review=1, published_followup_requires_review=1,
                        open_pharmacy=1, ticket_snapshot_missing_legacy=2, ticket_number_missing=2,
                        destination_snapshot_incomplete=2, visit_clinic_ambiguous=1,
                        guest_link_history=1, legacy_patient_locale=1)
        self.assertEqual(report['findingRowsByRule'], expected)
        self.assertNotIn('secret', json.dumps(report))
        patient_rows = [r for r in report['findings'] if r['rule'] == 'patient_multiple_open_records']
        self.assertEqual({r['relatedId'] for r in patient_rows}, {uid(n) for n in (2, 10, 11, 40)})
        self.assertTrue(all(r['recordCount'] == 4 for r in patient_rows))
        result = subprocess.run(['python', str(ROOT / 'scripts/data/legacy-audit.py'), '--server', self.server,
                                 '--database', self.database, '--trust-server-certificate'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), report)
        # Duplicate active steps for one Visit do not count as two patients in a room.
        self.insert('JourneyStep', 51, PatientJourneyId=uid(20), LocationId=uid(99), Kind='ReturnConsultation', Status='InProgress', DestinationSnapshot=snapshot)
        self.assertEqual(self.audit()['findingRowsByRule'], expected)
        for n, bad_snapshot in enumerate([None, '{}', '[]', snapshot.replace(uid(99), uid(98))], 60):
            self.insert('JourneyStep', n, PatientJourneyId=uid(20), LocationId=uid(99), Kind='Service', Status='Completed', DestinationSnapshot=bad_snapshot)
        self.assertEqual(self.audit()['findingRowsByRule']['destination_snapshot_incomplete'], 6)


class ParserTests(unittest.TestCase):
    def test_connection_failure_is_redacted(self):
        import io
        error = subprocess.CalledProcessError(1, ['sqlcmd'], output='health secret', stderr='password token')
        with patch('sys.argv', ['audit', '--server', 'localhost', '--database', 'explicit']), \
             patch.object(AUDIT.subprocess, 'run', side_effect=error), \
             patch('sys.stderr', new_callable=io.StringIO) as stderr, \
             patch('sys.stdout', new_callable=io.StringIO) as stdout:
            self.assertEqual(AUDIT.main(), 1)
            self.assertEqual(stdout.getvalue(), '')
            self.assertNotIn('secret', stderr.getvalue())
            self.assertNotIn('password', stderr.getvalue())
            self.assertNotIn('token', stderr.getvalue())

    def test_rejects_unexpected_output(self):
        with self.assertRaises(ValueError):
            AUDIT.parse_report('private database error')

    def test_requires_explicit_database(self):
        result = subprocess.run(['python', str(ROOT / 'scripts/data/legacy-audit.py'), '--server', 'localhost'], capture_output=True)
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
