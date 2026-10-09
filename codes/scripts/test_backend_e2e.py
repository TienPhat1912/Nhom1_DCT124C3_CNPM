"""Integration tests against a real isolated SQLite API, with exact HTTP assertions."""
import concurrent.futures
import json
import os
from pathlib import Path
import secrets
import socket
import sqlite3
import subprocess
import time
import unittest
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
DEPT = '11111111-0001-0000-0000-000000000001'
BLOOD = '22222222-0001-0000-0000-000000000001'
XRAY = '22222222-0001-0000-0000-000000000002'

class LifecycleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.work = ROOT / '.artifacts' / ('api-tests-' + uuid.uuid4().hex[:8])
        cls.work.mkdir(parents=True)
        cls.database = cls.work / 'test.db'
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            cls.port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{cls.port}'
        cls.env = {**os.environ, 'ASPNETCORE_ENVIRONMENT': 'Development',
            'Jwt__Secret': secrets.token_hex(32), 'ConnectionStrings__DefaultConnection': f'Data Source={cls.database}',
            'Logging__LogLevel__Default': 'Warning'}
        cls.start_server()
        cls.tokens = {}
        for role, email in [('rec','receptionist@hospital.demo'), ('doc','doctor@hospital.demo'),
            ('lab','labstaff@hospital.demo'), ('cash','cashier@hospital.demo'), ('admin','admin@hospital.demo'),
            ('patient','patient1@demo.com'), ('other','patient2@demo.com')]:
            cls.tokens[role] = cls.call('POST', '/api/auth/login', {'email':email,'password':'Demo@123'})[1]['token']

    @classmethod
    def start_server(cls):
        cls.log = open(cls.work / 'api.log', 'a', encoding='utf-8')
        dll = os.environ.get('API_DLL', str(ROOT / 'services/api/bin/Debug/net9.0/HospitalVisitApi.dll'))
        cls.proc = subprocess.Popen(['dotnet', dll, '--urls', cls.base], cwd=ROOT / 'services/api', env=cls.env, stdout=cls.log, stderr=subprocess.STDOUT)
        for _ in range(200):
            if cls.proc.poll() is not None:
                cls.log.close()
                raise RuntimeError((cls.work / 'api.log').read_text(encoding='utf-8'))
            try:
                if cls.call('GET', '/health')[0] == 200: return
            except OSError: pass
            time.sleep(.1)
        cls.proc.terminate()
        raise RuntimeError('API startup timed out')

    @classmethod
    def stop_server(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=15)
        cls.log.close()

    @classmethod
    def tearDownClass(cls):
        cls.stop_server()
        print('Evidence:', cls.work)

    @classmethod
    def call(cls, method, path, data=None, token=None):
        headers = {'Content-Type':'application/json'}
        if token: headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(cls.base + path, method=method,
            data=json.dumps(data).encode() if data is not None else None, headers=headers)
        try: response = urllib.request.urlopen(req, timeout=20)
        except urllib.error.HTTPError as error: response = error
        with response:
            raw = response.read().decode()
            return response.status, json.loads(raw) if raw else None

    def ok(self, method, path, data=None, token=None):
        status, result = self.call(method, path, data, token)
        self.assertEqual(status, 200, (path, result))
        return result

    def prepare(self, pharmacy=True, activate=True):
        guest = self.ok('POST','/api/auth/guest',{'language':'vi'})
        before = self.ok('GET','/api/patient/visits',token=guest['token'])
        request = self.ok('POST','/api/registration/request',{
            'source':1,'fullName':'Synthetic Patient','phoneNumber':'0901234567','conditionDescription':'Staff review'},guest['token'])
        self.assertEqual(self.ok('GET','/api/patient/visits',token=guest['token']), before)
        payload = {'registrationRequestId':request['requestId'],'departmentId':DEPT,'requiresPharmacy':pharmacy}
        ticket = self.ok('POST','/api/reception/confirm',payload,self.tokens['rec'])
        self.assertEqual(ticket['journeyStatus'],0)
        if activate: self.ok('POST','/api/journey/redeem-ticket',{'qrToken':ticket['ticketQrToken']},guest['token'])
        return guest, request, ticket

    def journey(self, guest, ticket):
        return self.ok('GET','/api/journey/'+ticket['visitId'],token=guest['token'])

    def complete(self, step, actor='doc'):
        return self.ok('POST',f"/api/services/step/{step['id']}/status",{'status':3},self.tokens[actor])

    def settlement(self, ticket, kind=1, key=None):
        return self.ok('POST','/api/settlement/record',{'visitId':ticket['visitId'],'type':kind,
            'amount':0,'idempotencyKey':key or uuid.uuid4().hex,'notes':'Synthetic settlement'},self.tokens['cash'])

    def test_authorization_and_qr_purposes(self):
        guest, request, ticket = self.prepare()
        other = self.ok('POST','/api/auth/guest',{})['token']
        for token in (other,self.tokens['other']):
            for path in ('/api/journey/','/api/content/diagnosis/','/api/patient/follow-up/'):
                self.assertEqual(self.call('GET',path+ticket['visitId'],token=token)[0],403)
            self.assertEqual(self.call('POST','/api/journey/redeem-ticket',{'qrToken':ticket['ticketQrToken']},token)[0],403)
        self.assertEqual(self.call('POST','/api/reception/confirm',{},guest['token'])[0],403)
        self.assertEqual(self.call('GET','/api/doctor/visits')[0],401)
        self.assertEqual(self.call('POST','/api/journey/redeem-ticket',{'qrToken':request['receptionQrToken']},guest['token'])[0],400)
        step = self.journey(guest,ticket)['steps'][0]
        self.assertEqual(self.call('POST',f"/api/services/step/{step['id']}/status",{'status':3},guest['token'])[0],403)
        self.assertEqual(self.call('POST',f"/api/services/step/{step['id']}/status",{'status':3},self.tokens['lab'])[0],403)

    def test_reception_concurrency_reprint_and_resume(self):
        guest = self.ok('POST','/api/auth/guest',{})
        request = self.ok('POST','/api/registration/request',{'source':1,'fullName':'Concurrent patient','phoneNumber':'0901234567'},guest['token'])
        payload = {'registrationRequestId':request['requestId'],'departmentId':DEPT,'requiresPharmacy':True}
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(lambda _:self.call('POST','/api/reception/confirm',payload,self.tokens['rec']),range(12)))
        ticket = results[0][1]
        self.assertTrue(all(code == 200 and item['visitId']==ticket['visitId'] and item['ticketQrToken']==ticket['ticketQrToken'] for code,item in results))
        self.assertEqual(len(self.ok('GET','/api/patient/visits',token=guest['token'])),1)
        self.ok('POST','/api/journey/redeem-ticket',{'qrToken':ticket['ticketQrToken']},guest['token'])
        reprint = self.ok('GET','/api/reception/reprint/'+ticket['visitId'],token=self.tokens['rec'])
        self.assertEqual(reprint['ticketQrToken'],ticket['ticketQrToken'])
        first = self.journey(guest,ticket)
        self.complete(first['steps'][0])
        resumed = self.ok('POST','/api/journey/redeem-ticket',{'qrToken':ticket['ticketQrToken']},guest['token'])
        self.assertEqual(resumed['journeyId'],first['journeyId'])
        self.assertEqual(resumed['steps'][0]['status'],3)

    def test_services_prerequisites_and_final_pharmacy(self):
        guest, _, ticket = self.prepare()
        for service in (BLOOD,XRAY): self.ok('POST','/api/doctor/orders',{'visitId':ticket['visitId'],'serviceId':service},self.tokens['doc'])
        journey = self.journey(guest,ticket)
        review = next(s for s in journey['steps'] if s['stepType']==3)
        self.assertEqual(self.call('POST',f"/api/services/step/{review['id']}/status",{'status':3},self.tokens['doc'])[0],400)
        self.complete(next(s for s in journey['steps'] if s['stepType']==0))
        services = [s for s in self.journey(guest,ticket)['steps'] if s['stepType'] in (1,2)]
        self.complete(services[0],'lab')
        self.assertEqual(next(s for s in self.journey(guest,ticket)['steps'] if s['stepType']==3)['status'],0)
        self.complete(services[1],'lab')
        self.complete(review)
        self.assertFalse(self.settlement(ticket,0)['isVisitClosed'])
        self.assertTrue(self.settlement(ticket)['isVisitClosed'])
        self.assertTrue(self.journey(guest,ticket)['canCompletePharmacy'])
        self.ok('POST',f"/api/journey/{ticket['visitId']}/complete-pharmacy",token=guest['token'])
        self.assertEqual(self.journey(guest,ticket)['journeyStatus'],2)

    def test_early_settlement_and_late_activation(self):
        guest, _, ticket = self.prepare(activate=False)
        self.assertFalse(self.settlement(ticket)['isVisitClosed'])
        self.complete(self.journey(guest,ticket)['steps'][0])
        journey = self.journey(guest,ticket)
        self.assertEqual(journey['visitStatus'],1)
        self.assertEqual(journey['journeyStatus'],0)
        self.assertFalse(journey['canCompletePharmacy'])
        self.ok('POST','/api/journey/redeem-ticket',{'qrToken':ticket['ticketQrToken']},guest['token'])
        self.ok('POST',f"/api/journey/{ticket['visitId']}/complete-pharmacy",token=guest['token'])

    def test_no_pharmacy_automatic_completion(self):
        guest, _, ticket = self.prepare(pharmacy=False,activate=False)
        self.complete(self.journey(guest,ticket)['steps'][0])
        self.assertTrue(self.settlement(ticket,2)['isVisitClosed'])
        self.assertEqual(self.journey(guest,ticket)['journeyStatus'],2)
        resumed = self.ok('POST','/api/journey/redeem-ticket',{'qrToken':ticket['ticketQrToken']},guest['token'])
        self.assertEqual(resumed['journeyStatus'],2)

    def test_new_order_invalidates_earlier_settlement(self):
        guest, _, ticket = self.prepare()
        self.settlement(ticket)
        self.ok('POST','/api/doctor/orders',{'visitId':ticket['visitId'],'serviceId':BLOOD},self.tokens['doc'])
        self.complete(self.journey(guest,ticket)['steps'][0])
        self.complete(next(s for s in self.journey(guest,ticket)['steps'] if s['stepType']==1),'lab')
        self.complete(next(s for s in self.journey(guest,ticket)['steps'] if s['stepType']==3))
        self.assertEqual(self.journey(guest,ticket)['visitStatus'],0)
        self.assertTrue(self.settlement(ticket)['isVisitClosed'])

    def test_publication_immutable_correction_fallback_and_audio(self):
        guest, _, ticket = self.prepare()
        payload = {'visitId':ticket['visitId'],'diagnosisVi':'Reviewed source','careInstructionsVi':'Reviewed care','enTranslationApproved':False}
        draft = self.ok('POST','/api/doctor/diagnosis/draft',payload,self.tokens['doc'])
        path = '/api/content/diagnosis/'+ticket['visitId']
        self.assertEqual(self.call('GET',path,token=guest['token'])[0],404)
        self.assertEqual(self.call('POST','/api/doctor/diagnosis/publish/'+draft['id'],token=self.tokens['admin'])[0],403)
        pub = self.ok('POST','/api/doctor/diagnosis/publish/'+draft['id'],token=self.tokens['doc'])
        self.assertEqual(pub['id'],self.ok('POST','/api/doctor/diagnosis/publish/'+draft['id'],token=self.tokens['doc'])['id'])
        current = self.ok('GET',path+'?lang=en',token=guest['token'])
        self.assertTrue(current['isFallback'])
        correction = self.ok('POST','/api/doctor/diagnosis/draft',{**payload,'id':pub['id'],'diagnosisVi':'Corrected source'},self.tokens['doc'])
        self.assertNotEqual(correction['id'],pub['id'])
        self.assertEqual(self.ok('GET',path,token=guest['token'])['diagnosis'],'Reviewed source')
        self.ok('POST','/api/doctor/diagnosis/publish/'+correction['id'],token=self.tokens['doc'])
        audio = self.ok('GET',f"/api/content/audio/{correction['id']}?section=diagnosis&lang=vi",token=guest['token'])
        self.assertIn('Corrected source',audio['text'])
        self.assertFalse(audio['audioAvailable'])
        self.assertEqual(self.call('GET',f"/api/content/audio/{pub['id']}?section=care",token=guest['token'])[0],409)
        self.assertTrue(self.ok('GET','/api/notifications',token=guest['token']))

    def test_guest_conversion_preserves_identity_and_retires_guest(self):
        guest, request, ticket = self.prepare()
        original = self.ok('GET','/api/registration/request/'+request['requestId'],token=guest['token'])
        result = self.ok('POST','/api/auth/register-convert-guest',{'guestToken':guest['guestToken'],'register':{
            'email':uuid.uuid4().hex+'@example.test','password':'Password@123','fullName':'Synthetic account'} })
        self.assertEqual(result['user']['patientId'],original['patientId'])
        linked = self.ok('GET','/api/journey/'+ticket['visitId'],token=result['token'])
        self.assertEqual(linked['journeyId'],ticket['journeyId'])
        self.assertEqual(linked['journeyStatus'],1)
        self.assertEqual(self.call('GET','/api/journey/'+ticket['visitId'],token=guest['token'])[0],401)
        self.assertEqual(self.call('POST','/api/auth/register-convert-guest',{'guestToken':guest['guestToken'],'register':{
            'email':uuid.uuid4().hex+'@example.test','password':'Password@123','fullName':'Replay'}})[0],400)

    def test_supplement_same_request_and_restart(self):
        guest = self.ok('POST','/api/auth/guest',{})
        request = self.ok('POST','/api/registration/request',{'source':1,'fullName':'Supplement patient','phoneNumber':'0901234567'},guest['token'])
        self.ok('POST',f"/api/registration/request/{request['requestId']}/supplement-question",{'question':'The reception staff needs additional information. Please review and respond.'},self.tokens['rec'])
        self.ok('POST',f"/api/registration/request/{request['requestId']}/supplement-answer",{'answer':'Confirmed'},guest['token'])
        cls = type(self)
        cls.stop_server(); cls.start_server()
        restored = self.ok('GET','/api/registration/request/'+request['requestId'],token=guest['token'])
        self.assertEqual(restored['id'],request['requestId'])
        self.assertEqual(restored['supplementInfo'],'Confirmed')

    def test_continuation_failure_preserves_guest_and_success_consumes_claim(self):
        guest, request, ticket = self.prepare()
        claim = self.ok('POST','/api/auth/guest-continuation',{'returnTarget':'/visit/'+ticket['visitId']},guest['token'])
        self.ok('POST','/api/registration/request',{'source':1,'fullName':'Established account','phoneNumber':'0901234567'},self.tokens['patient'])
        self.assertEqual(self.call('POST','/api/auth/guest-continuation',{'returnTarget':'//external.test'},guest['token'])[0],400)
        self.assertEqual(self.call('POST','/api/auth/convert-guest',{'guestToken':claim['continuationToken']},self.tokens['patient'])[0],400)
        self.assertEqual(self.journey(guest,ticket)['journeyId'],ticket['journeyId'])
        account = self.ok('POST','/api/auth/register',{'email':uuid.uuid4().hex+'@example.test','password':'Password@123','fullName':'Verified target'})
        linked = self.ok('POST','/api/auth/convert-guest',{'guestToken':claim['continuationToken']},account['token'])
        self.assertEqual(self.ok('GET','/api/journey/'+ticket['visitId'],token=linked['token'])['journeyId'],ticket['journeyId'])
        self.assertEqual(self.call('POST','/api/auth/convert-guest',{'guestToken':claim['continuationToken']},linked['token'])[0],400)

    def test_verified_appointment_identity_and_conflict(self):
        first = self.ok('POST','/api/auth/register',{'email':uuid.uuid4().hex+'@example.test','password':'Password@123','fullName':'Booked patient'})
        second = self.ok('POST','/api/auth/register',{'email':uuid.uuid4().hex+'@example.test','password':'Password@123','fullName':'Other patient'})
        self.assertEqual(self.call('GET','/api/appointments/APT-2026-001234',token=first['token'])[0],403)
        credentials = {'externalAccount':'demo-patient-001','password':'AppointmentDemo@123'}
        self.assertEqual(self.call('POST','/api/appointments/link',{**credentials,'password':'wrong'},first['token'])[0],400)
        self.ok('POST','/api/appointments/link',credentials,first['token'])
        self.assertEqual(self.call('POST','/api/appointments/link',credentials,second['token'])[0],409)
        appointment = self.ok('GET','/api/appointments',token=first['token'])[0]
        self.ok('POST','/api/registration/request',{'source':0,'appointmentId':appointment['appointmentId'],'fullName':appointment['patientName'],'phoneNumber':appointment['phoneNumber']},first['token'])
        self.assertEqual(self.ok('GET','/api/patient/visits',token=first['token']),[])

    def test_order_idempotency_mapping_validation_and_cancel(self):
        guest, _, ticket = self.prepare()
        data = {'visitId':ticket['visitId'],'serviceId':BLOOD,'idempotencyKey':uuid.uuid4().hex}
        first = self.ok('POST','/api/doctor/orders',data,self.tokens['doc'])
        retry = self.ok('POST','/api/doctor/orders',data,self.tokens['doc'])
        self.assertEqual(first['orderId'],retry['orderId'])
        self.assertEqual(self.call('POST','/api/doctor/orders',{**data,'serviceId':XRAY},self.tokens['doc'])[0],400)
        mappings = self.ok('GET','/api/admin/configuration/mappings',token=self.tokens['admin'])
        blood = next(m for m in mappings if m['serviceId']==BLOOD)
        self.assertEqual(self.call('POST','/api/admin/mappings',{**blood,'prerequisiteServiceIds':json.dumps([BLOOD])},self.tokens['admin'])[0],400)
        self.ok('POST','/api/admin/mappings',{**blood,'isActive':False},self.tokens['admin'])
        try:
            self.assertEqual(self.call('POST','/api/doctor/orders',{**data,'idempotencyKey':uuid.uuid4().hex},self.tokens['doc'])[0],400)
            orders = self.ok('GET','/api/doctor/orders/'+ticket['visitId'],token=self.tokens['doc'])
            self.assertEqual(len(orders),1)
        finally: self.ok('POST','/api/admin/mappings',blood,self.tokens['admin'])
        self.ok('PUT','/api/doctor/orders/'+first['orderId'],{'cancel':True,'reason':'Duplicate service withdrawn'},self.tokens['doc'])
        self.complete(self.journey(guest,ticket)['steps'][0])
        cancelled = next(s for s in self.journey(guest,ticket)['steps'] if s['stepType']==1)
        self.assertEqual(cancelled['status'],5)
        self.assertEqual(self.call('POST',f"/api/services/step/{cancelled['id']}/status",{'status':3},self.tokens['lab'])[0],400)

    def test_assistance_is_scoped_and_patient_can_track_status(self):
        guest, _, ticket = self.prepare()
        other, _, _ = self.prepare()
        aid = self.ok('POST','/api/assistance',{'visitId':ticket['visitId'],'category':'Navigation','description':'Synthetic help'},guest['token'])
        self.assertEqual(self.ok('GET','/api/patient/assistance',token=other['token']),[])
        self.assertFalse(any(a['id']==aid['id'] for a in self.ok('GET','/api/assistance',token=self.tokens['lab'])))
        self.ok('PUT','/api/assistance/'+aid['id']+'/status',{'status':2,'resolution':'Staff assisted'},self.tokens['rec'])
        own = self.ok('GET','/api/patient/assistance',token=guest['token'])
        self.assertEqual(own[0]['status'],2)

    def test_recovery_reissues_code_without_recreating_records(self):
        guest, request, ticket = self.prepare()
        next_guest = self.ok('POST','/api/auth/guest',{})
        path = '/api/reception/reissue/'+ticket['visitId']
        self.assertEqual(self.call('POST',path,{'identityVerified':False},self.tokens['rec'])[0],400)
        recovered = self.ok('POST',path,{'identityVerified':True,'guestSessionId':next_guest['guestSessionId']},self.tokens['rec'])
        self.assertNotEqual(recovered['ticketQrToken'],ticket['ticketQrToken'])
        self.assertEqual(self.call('GET','/api/journey/'+ticket['visitId'],token=guest['token'])[0],401)
        self.assertEqual(self.call('POST','/api/journey/redeem-ticket',{'qrToken':ticket['ticketQrToken']},next_guest['token'])[0],400)
        resumed = self.ok('POST','/api/journey/redeem-ticket',{'qrToken':recovered['ticketQrToken']},next_guest['token'])
        self.assertEqual(resumed['journeyId'],ticket['journeyId'])
        self.assertEqual(len(self.ok('GET','/api/patient/visits',token=next_guest['token'])),1)

    def test_assistance_before_registration_and_optional_booking(self):
        guest = self.ok('POST','/api/auth/guest',{})
        created = self.ok('POST','/api/assistance',{'category':'Reception','description':'Help before registration'},guest['token'])
        self.assertEqual(self.ok('GET','/api/patient/assistance',token=guest['token'])[0]['id'],created['id'])
        self.assertEqual(self.ok('GET','/api/patient/visits',token=guest['token']),[])
        guest, _, ticket = self.prepare()
        self.assertFalse(self.ok('GET',f"/api/patient/follow-up/{ticket['visitId']}/booking",token=guest['token'])['available'])

    def test_desk_verifies_guest_booking_without_automatic_link(self):
        guest = self.ok('POST','/api/auth/guest',{})
        request = self.ok('POST','/api/registration/request',{'source':1,'fullName':'Booking attendee','phoneNumber':'0901234567'},guest['token'])
        path = f"/api/reception/requests/{request['requestId']}/booking"
        self.assertEqual(self.call('POST',path,{'reference':'APT-2026-001234','attendeeVerified':False},self.tokens['rec'])[0],400)
        linked = self.ok('POST',path,{'reference':'APT-2026-001234','attendeeVerified':True},self.tokens['rec'])
        self.assertEqual(linked['appointmentId'],'APT-2026-001234')
        self.assertEqual(linked['source'],0)
        self.assertEqual(self.ok('GET','/api/patient/visits',token=guest['token']),[])

if __name__ == '__main__':
    unittest.main(verbosity=2)
