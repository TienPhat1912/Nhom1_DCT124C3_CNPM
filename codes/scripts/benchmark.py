"""NFR-PERF-01: isolated SQLite, 20 real guest contexts, 10,000 steps."""
import concurrent.futures
import json
import math
import os
import platform
import sqlite3
import threading
import time
import uuid
from test_backend_e2e import LifecycleTests

LifecycleTests.setUpClass()
try:
    case = LifecycleTests()
    contexts = [case.prepare(pharmacy=False) for _ in range(20)]
    with sqlite3.connect(LifecycleTests.database) as database:
        columns = [row[1] for row in database.execute('PRAGMA table_info(JourneySteps)')]
        for _, _, visit in contexts:
            journey_id = visit['journeyId'].upper()
            rows = database.execute('SELECT * FROM JourneySteps WHERE JourneyId=?', (journey_id,)).fetchall()
            assert len(rows) == 2, len(rows)
            prototype = dict(zip(columns, rows[0]))
            inserts = []
            for index in range(498):
                item = {**prototype, 'Id':str(uuid.uuid4()).upper(), 'StepType':6, 'Status':3, 'SortOrder':index+2}
                inserts.append(tuple(item[column] for column in columns))
            database.executemany('INSERT INTO JourneySteps ('+','.join('"'+column+'"' for column in columns)+') VALUES ('+','.join('?' for _ in columns)+')', inserts)
        assert database.execute('SELECT count(*) FROM JourneySteps').fetchone()[0] == 10000
    barrier = threading.Barrier(20)
    def workload(context):
        guest, _, visit = context
        endpoints = ['/api/journey/'+visit['visitId'], '/api/patient/visits', '/api/notifications']
        # Warm up EF/JIT before recording normal steady-state requests.
        for endpoint in endpoints: assert LifecycleTests.call('GET', endpoint, token=guest['token'])[0] == 200
        barrier.wait()
        times = []
        for index in range(30):
            start = time.perf_counter()
            status, _ = LifecycleTests.call('GET', endpoints[index % len(endpoints)], token=guest['token'])
            times.append((time.perf_counter()-start)*1000)
            assert status == 200, status
        return times
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        samples = sorted(value for result in executor.map(workload, contexts) for value in result)
    p95 = samples[math.ceil(.95*len(samples))-1]
    provider_start = time.perf_counter()
    assert LifecycleTests.call('GET','/api/appointments/APT-2026-001234',token=LifecycleTests.tokens['rec'])[0] == 200
    provider_ms = (time.perf_counter()-provider_start)*1000
    report = {'requirement':'NFR-PERF-01','concurrency':20,'storedSteps':10000,'stepsPerJourney':500,'requests':len(samples),
        'workload':'GET journey (500 steps), owned visit history, notifications; 30 requests per guest; warmed EF/JIT',
        'p95Ms':round(p95,2),'maxMs':round(max(samples),2),'thresholdMs':2000,'passed':p95<=2000,
        'environment':{'os':platform.platform(),'cpu':platform.processor(),'logicalCpus':os.cpu_count(),'python':platform.python_version(),'database':'SQLite local disk','api':'.NET 9 published Release, one process' if os.environ.get('API_DLL') else '.NET 9 Debug, one process'},
        'provider':{'adapter':'deterministic in-process appointment fixture; no external network latency claimed','separateRequestMs':round(provider_ms,2)}}
    output = LifecycleTests.work.parent / 'performance.json'
    output.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))
    if not report['passed']: raise SystemExit(1)
finally:
    LifecycleTests.tearDownClass()
