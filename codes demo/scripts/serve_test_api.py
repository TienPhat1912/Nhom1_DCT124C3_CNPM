"""Launch a disposable API database for browser tests, never the user's demo DB."""
import os
from pathlib import Path
import secrets
import subprocess
import sys
import uuid

root = Path(__file__).resolve().parents[1]
work = root / '.artifacts' / ('browser-' + uuid.uuid4().hex[:8])
work.mkdir(parents=True)
environment = {**os.environ, 'ASPNETCORE_ENVIRONMENT':'Development', 'Jwt__Secret':secrets.token_hex(32),
    'ConnectionStrings__DefaultConnection':f'Data Source={work / "browser.db"}',
    'Logging__LogLevel__Default':'Warning'}
dll = os.environ.get('API_DLL', str(root / 'services/api/bin/Debug/net9.0/HospitalVisitApi.dll'))
process = subprocess.Popen(['dotnet', dll, '--urls', 'http://127.0.0.1:5049'], cwd=root / 'services/api', env=environment)
try:
    sys.exit(process.wait())
except KeyboardInterrupt:
    process.terminate()
    process.wait(timeout=15)
