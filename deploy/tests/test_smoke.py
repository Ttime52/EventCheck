"""Offline unit tests for deploy/smoke_test.py (the network is mocked).

Run (repo root):  python3 -m unittest discover -s deploy/tests -p 'test_smoke.py'
CI runs it too (.github/workflows/ci-docker.yml).

Covers: public checks pass; optional login/session/logout checks; a database
that is not ready fails even when the HTTP endpoint responds with the wrong
readiness status.
CHANGE ME: if you change the endpoints in smoke_test.py, update `response()` below.
"""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('smoke', Path(__file__).parents[1] / 'smoke_test.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeTests(unittest.TestCase):
    def response(self, base, path, data=None, token=None):
        return {
            '/health': b'{"status":"ok"}',
            '/api/ready': b'{"status":"ready"}',
            '/': b'<html></html>',
        }[path]

    @patch.dict('os.environ', {}, clear=True)
    def test_public_checks_pass(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req:
            smoke.check('https://demo.test')
            self.assertEqual(req.call_count, 3)

    @patch.dict('os.environ', {}, clear=True)
    def test_missing_login_configuration_skips(self):
        with patch.object(smoke, 'request', side_effect=self.response) as req, \
             patch('builtins.print') as output:
            smoke.check('https://demo.test')
            output.assert_any_call('SKIP login')
            self.assertEqual(req.call_count, 3)

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'demo@example.test'}, clear=True)
    def test_partial_login_configuration_fails_closed(self):
        with patch.object(smoke, 'request', side_effect=self.response), \
             patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'configured together'):
                smoke.check('https://demo.test')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'demo@example.test', 'SMOKE_PASSWORD': 'not-printed'}, clear=True)
    def test_configured_login_runs_authenticated_check(self):
        with patch.object(smoke, 'request', side_effect=self.response), \
             patch.object(smoke, 'authenticated_check') as login:
            smoke.check('https://demo.test')
            login.assert_called_once_with('https://demo.test', 'demo@example.test', 'not-printed')

    @patch.dict('os.environ', {'SMOKE_EMAIL': 'demo@example.test', 'SMOKE_PASSWORD': 'wrong'}, clear=True)
    def test_rejected_login_is_reported_without_secret(self):
        with patch.object(smoke, 'request', side_effect=self.response), \
             patch.object(smoke, 'authenticated_check', side_effect=RuntimeError('Login smoke check failed')):
            with self.assertRaisesRegex(RuntimeError, 'Login smoke check failed'):
                smoke.check('https://demo.test')

    def test_authenticated_check_persists_cookie_and_origin(self):
        class Response:
            def __init__(self, status, body, headers=None):
                self.status = status
                self._body = body
                self.headers = headers or {}

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return self._body

        class CookieJar:
            def __init__(self):
                self.cookies = []

        class Opener:
            def __init__(self, jar):
                self.jar = jar
                self.requests = []
                self.responses = iter([
                    Response(200, json.dumps({'data': {'user': {'id': 'user-1'}}}).encode(),
                             {'Set-Cookie': 'eventcheck_session=session-1; Path=/'}),
                    Response(200, json.dumps({'data': {'user': {'id': 'user-1'}}}).encode()),
                    Response(204, b''),
                ])

            def open(self, request, timeout):
                self.requests.append(request)
                response = next(self.responses)
                if response.headers.get('Set-Cookie'):
                    self.jar.cookies.append(response.headers['Set-Cookie'])
                return response

        jar = CookieJar()
        opener = Opener(jar)
        with patch('urllib.request.build_opener', return_value=opener), \
             patch('http.cookiejar.CookieJar', return_value=jar):
            smoke.authenticated_check('https://demo.test', 'demo@example.test', 'secret')

        self.assertEqual(len(opener.requests), 3)
        self.assertEqual(opener.requests[0].get_header('Origin'), 'https://demo.test')
        self.assertEqual(opener.requests[1].get_header('Origin'), 'https://demo.test')
        self.assertEqual(opener.requests[2].get_header('Origin'), 'https://demo.test')
        self.assertEqual(jar.cookies, ['eventcheck_session=session-1; Path=/'])

    def test_authenticated_check_rejects_login(self):
        class Response:
            status = 401

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'{"error":{"code":"INVALID_CREDENTIALS"}}'

        class Opener:
            def open(self, _request, timeout):
                return Response()

        with patch('urllib.request.build_opener', return_value=Opener()):
            with self.assertRaisesRegex(RuntimeError, 'Login smoke check failed'):
                smoke.authenticated_check('https://demo.test', 'demo@example.test', 'wrong')

    def test_authenticated_check_rejects_invalid_session_response(self):
        class Response:
            status = 200

            def __init__(self, invalid=False):
                self.invalid = invalid

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'{"data":{}}' if self.invalid else b'{"data":{"user":{"id":"user-1"}}}'

        class Opener:
            def __init__(self):
                self.count = 0

            def open(self, _request, timeout):
                self.count += 1
                return Response(invalid=self.count > 1)

        with patch('urllib.request.build_opener', return_value=Opener()):
            with self.assertRaisesRegex(RuntimeError, 'Session smoke check failed'):
                smoke.authenticated_check('https://demo.test', 'demo@example.test', 'secret')

    @patch.dict('os.environ', {}, clear=True)
    def test_db_not_ready_fails_even_when_http_responds(self):
        def disconnected(base, path, **kwargs):
            return b'{"status":"unavailable"}' if path == '/api/ready' else self.response(base, path)
        with patch.object(smoke, 'request', side_effect=disconnected), patch.object(smoke.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '/api/ready'):
                smoke.check('https://demo.test')

if __name__ == '__main__':
    unittest.main()
