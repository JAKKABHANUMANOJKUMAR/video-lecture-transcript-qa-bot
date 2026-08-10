import json
import urllib.request

payload = json.dumps({"email": "user@example.com", "password": "password"}).encode()
req = urllib.request.Request(
    "http://localhost:8000/api/auth/login",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        print("STATUS", resp.status)
        print(resp.read().decode())
except Exception as exc:
    print(type(exc).__name__, exc)
