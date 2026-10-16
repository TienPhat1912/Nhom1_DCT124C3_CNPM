import json
import os
import sys
import urllib.request

base = sys.argv[1].rstrip('/') if len(sys.argv)>1 else 'http://localhost:8080'
def get(path):
    with urllib.request.urlopen(base+path,timeout=20) as response:
        assert response.status==200
        return response.read()
assert json.loads(get('/health'))['status']=='Healthy'
assert b'<html' in get('/').lower()
request=urllib.request.Request(base+'/api/auth/guest',data=b'{"language":"vi"}',headers={'Content-Type':'application/json'})
with urllib.request.urlopen(request,timeout=20) as response:
    token=json.load(response)['token']
request=urllib.request.Request(base+'/api/patient/visits',headers={'Authorization':'Bearer '+token})
with urllib.request.urlopen(request,timeout=20) as response:
    assert json.load(response)==[]
print('Web, API readiness, guest authentication and owned history smoke passed')
