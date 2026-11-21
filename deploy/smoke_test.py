"""Public deployment checks. Credentials/tokens are never printed.

WHAT THIS SCRIPT DOES
    Called by .github/workflows/deploy.yml after a deployment:
        python3 deploy/smoke_test.py SERVICE_URL
    It checks the live service and exits non-zero (failing the workflow) if any
    check fails. Each public check is retried up to 5 times, 3 seconds apart, to
    tolerate Cloud Run cold starts.

    Checks (in order)
      1. GET /health       -> {"status": "ok"}
      2. GET /api/ready    -> {"status": "ready"} (proves the DB works)
      3. GET /             -> HTML page (the built React app is served)

IMPORTANT
    Uses only the Python standard library (no pip install needed).
    Offline unit tests: deploy/tests/test_smoke.py

REFERENCES
    - urllib.request : https://docs.python.org/3/library/urllib.request.html
    - unittest.mock  : https://docs.python.org/3/library/unittest.mock.html

CHANGE ME (groups using another tech stack):
    - the endpoint paths and expected responses in check() below
      (/health, /api/ready, /)
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request


# --- HTTP helper --------------------------------------------------------------
# Returns the response body (bytes). Raises on HTTP errors / timeouts.
def request(base, path, data=None, token=None, cookie=None, origin=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if cookie:
        headers['Cookie'] = cookie
    if origin:
        headers['Origin'] = origin
    req = urllib.request.Request(base + path, headers=headers,
        data=json.dumps(data).encode() if data is not None else None)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def authenticated_check(base, email, password):
    """Exercise EventCheck's cookie session using the real auth endpoints."""
    import http.cookiejar

    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    origin = (os.environ.get('SMOKE_ORIGIN') or base).rstrip('/')
    if not origin:
        raise RuntimeError('Smoke service URL is required')

    def call(path, data=None):
        headers = {'Origin': origin}
        if data is not None:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(
            base.rstrip('/') + path,
            headers=headers,
            data=json.dumps(data).encode() if data is not None else None,
            method='POST' if data is not None else 'GET',
        )
        with opener.open(req, timeout=30) as response:
            return response.status, response.read()

    try:
        status, body = call('/api/v1/auth/login', {
            'loginIdentifier': email,
            'password': password,
        })
        payload = json.loads(body)
        if status != 200 or not payload.get('data', {}).get('user', {}).get('id'):
            raise RuntimeError('Login smoke check failed')
        status, body = call('/api/v1/me')
        if status != 200 or not json.loads(body).get('data', {}).get('user', {}).get('id'):
            raise RuntimeError('Session smoke check failed')
        status, _ = call('/api/v1/auth/logout', {})
        if status != 204:
            raise RuntimeError('Logout smoke check failed')
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError, RuntimeError) as error:
        if isinstance(error, RuntimeError):
            raise
        raise RuntimeError('Authenticated smoke check failed') from None
    print('PASS login/session/logout')


def check(base):
    # --- Public checks (CHANGE ME: paths + predicates for your own API) -------
    for path, predicate in (
        ('/health', lambda b: json.loads(b).get('status') == 'ok'),
        ('/api/ready', lambda b: json.loads(b).get('status') == 'ready'),
        ('/', lambda b: b'<html' in b.lower()),
        
    ):
        # Retry: a cold Cloud Run instance may need a few seconds to start.
        for attempt in range(5):
            try:
                if not predicate(request(base, path)):
                    raise ValueError('Unexpected response')
                break
            except (urllib.error.URLError, TimeoutError, ValueError):
                if attempt == 4:
                    raise RuntimeError('Smoke check failed: ' + path) from None
                time.sleep(3)
        print('PASS ' + path)

    email = os.environ.get('SMOKE_EMAIL')
    password = os.environ.get('SMOKE_PASSWORD')
    if not email and not password:
        print('SKIP login')
    elif not email or not password:
        raise RuntimeError('SMOKE_EMAIL and SMOKE_PASSWORD must be configured together')
    else:
        authenticated_check(base.rstrip('/'), email, password)

# --- Entry point ----------------------------------------------------------------
if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 deploy/smoke_test.py SERVICE_URL')
    check(sys.argv[1].rstrip('/'))
