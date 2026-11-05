import os
import re
import sys
from urllib.parse import urlparse

_VENDOR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vendor')
if os.path.isdir(_VENDOR) and _VENDOR not in sys.path:
    sys.path.insert(0, _VENDOR)

from flask import Flask, abort, g, jsonify, redirect, request, send_from_directory
from werkzeug.exceptions import HTTPException
from werkzeug.utils import safe_join

import orbita_auth as auth

PUBLIC_DIR = os.path.abspath(os.environ.get('ORBITA_PUBLIC_DIR') or os.path.join(os.path.dirname(__file__), '..', 'public'))
COOKIE_NAME = 'orbita_session'
COOKIE_SECURE = os.environ.get('ORBITA_COOKIE_SECURE', '1') != '0'
APP_VERSION = '2.6.2'
GITHUB_RELEASES = 'https://github.com/EzWinStudio/Orbita/releases/download'
DOWNLOAD_PATTERN = re.compile(r'^Orbita-(Setup|Portable)-(\d+\.\d+\.\d+)\.exe$')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 3_200_000
app.config['JSON_SORT_KEYS'] = False


def get_db():
    if 'db' not in g:
        g.db = auth.connect()
        auth.ensure_schema(g.db)
    return g.db


@app.teardown_appcontext
def close_db(_error):
    db = g.pop('db', None)
    if db is not None:
        try:
            db.close()
        except Exception:
            pass


def client_ip_hash():
    forwarded = request.headers.get('x-forwarded-for', '').split(',')[0].strip()
    address = forwarded or request.remote_addr or ''
    return auth.sha256_hex('orbita-ip:' + address) if address else None


def user_agent():
    return (request.headers.get('user-agent') or '')[:255]


def error_response(code, status, **extra):
    payload = {'ok': False, 'code': code}
    payload.update(extra)
    return jsonify(payload), status


def read_json(max_bytes=32_000):
    if request.content_length and request.content_length > max_bytes:
        return None, error_response('payload_too_large', 413)
    if not request.is_json:
        return None, error_response('invalid_input', 400)
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return None, error_response('invalid_input', 400)
    return body, None


def origin_allowed():
    origin = request.headers.get('Origin')
    if not origin:
        return True
    allowed = {
        'https://orbita.wasmer.app',
        'https://orbita-auth-probe.wasmer.app',
    }
    for value in os.environ.get('ORBITA_ALLOWED_ORIGINS', '').split(','):
        if value.strip():
            allowed.add(value.strip().rstrip('/'))
    if origin.rstrip('/') in allowed:
        return True
    try:
        return urlparse(origin).netloc == request.host
    except ValueError:
        return False


def require_origin():
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and not origin_allowed():
        return error_response('forbidden_origin', 403)
    return None


def set_session_cookie(response, token, expires_at, remember):
    max_age = max(0, int(expires_at) - auth.now_seconds()) if remember else None
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=max_age,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite='Lax',
        path='/',
    )
    return response


def clear_session_cookie(response):
    response.delete_cookie(
        COOKIE_NAME,
        path='/',
        httponly=True,
        secure=COOKIE_SECURE,
        samesite='Lax',
    )
    return response


def session_context():
    token = request.cookies.get(COOKIE_NAME) or ''
    if not token:
        return None, None
    return auth.find_by_session(get_db(), token)


@app.route('/api/health')
def health():
    try:
        db = get_db()
        with db.cursor() as cur:
            cur.execute('SELECT 1 AS ok')
            cur.fetchone()
    except Exception:
        return error_response('database_unavailable', 503)
    return jsonify({
        'ok': True,
        'db': 'ok',
        'scrypt': hasattr(__import__('hashlib'), 'scrypt'),
        'version': APP_VERSION,
    })


@app.route('/api/auth/login', methods=['POST'])
def login():
    blocked = require_origin()
    if blocked:
        return blocked
    body, problem = read_json()
    if problem:
        return problem
    try:
        result = auth.login(
            get_db(),
            body.get('email'),
            body.get('password'),
            bool(body.get('remember', True)),
            user_agent(),
            client_ip_hash(),
        )
    except Exception:
        return error_response('server_error', 503)
    if not result.get('ok'):
        extra = {}
        if result.get('retryAfter'):
            extra['retryAfter'] = int(result['retryAfter'])
        status = 401
        if result['code'] == 'locked':
            status = 423
        elif result['code'] == 'two_factor_unsupported':
            status = 403
        return error_response(result['code'], status, **extra)
    response = jsonify({'ok': True, 'account': result['account'], 'expiresAt': result['expiresAt']})
    return set_session_cookie(
        response,
        result['token'],
        result['expiresAt'],
        bool(body.get('remember', True)),
    )


@app.route('/api/auth/register', methods=['POST'])
def register():
    blocked = require_origin()
    if blocked:
        return blocked
    body, problem = read_json()
    if problem:
        return problem
    try:
        result = auth.register(
            get_db(),
            body.get('name'),
            body.get('email'),
            body.get('password'),
            bool(body.get('remember', True)),
            user_agent(),
            client_ip_hash(),
        )
    except Exception:
        return error_response('server_error', 503)
    if not result.get('ok'):
        status = 400
        if result['code'] == 'email_exists':
            status = 409
        return error_response(result['code'], status)
    response = jsonify({'ok': True, 'account': result['account'], 'expiresAt': result['expiresAt']})
    response.status_code = 201
    return set_session_cookie(
        response,
        result['token'],
        result['expiresAt'],
        bool(body.get('remember', True)),
    )


@app.route('/api/auth/session', methods=['GET'])
def session():
    token = request.cookies.get(COOKIE_NAME) or ''
    if not token:
        return error_response('no_session', 401)
    try:
        account, record = session_context()
    except Exception:
        return error_response('server_error', 503)
    if not account or not record:
        response = error_response('invalid_session', 401)[0]
        return clear_session_cookie(response), 401
    response = jsonify({
        'ok': True,
        'account': auth.public_account(account),
        'expiresAt': int(record['expires_at']),
    })
    return response


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    blocked = require_origin()
    if blocked:
        return blocked
    token = request.cookies.get(COOKIE_NAME) or ''
    try:
        if token:
            auth.logout(get_db(), token)
    except Exception:
        pass
    response = jsonify({'ok': True})
    return clear_session_cookie(response)


@app.route('/api/auth/profile', methods=['PATCH'])
def profile():
    blocked = require_origin()
    if blocked:
        return blocked
    try:
        account, _record = session_context()
    except Exception:
        return error_response('server_error', 503)
    if not account:
        return error_response('invalid_session', 401)
    body, problem = read_json(max_bytes=auth.MAX_AVATAR_CHARS + 64_000)
    if problem:
        return problem
    avatar = body.get('avatar')
    try:
        result = auth.update_profile(get_db(), account['id'], avatar)
    except Exception:
        return error_response('server_error', 503)
    if not result.get('ok'):
        return error_response(result['code'], 400)
    return jsonify({'ok': True, 'account': result['account']})


def is_immutable_asset(path):
    return path.startswith('assets/') or path.startswith('brand-icons/') or path.startswith('icons/')


@app.route('/download/<path:name>')
def download_file(name):
    base = os.path.basename(name)
    match = DOWNLOAD_PATTERN.match(base)
    if match:
        return redirect(f'{GITHUB_RELEASES}/v{match.group(2)}/{base}', code=302)
    return static_files(f'download/{name}')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def static_files(path):
    if path.startswith('api/'):
        abort(404)
    relative = path or 'index.html'
    target = safe_join(PUBLIC_DIR, relative)
    if target is None:
        abort(404)
    if os.path.isdir(target):
        target = os.path.join(target, 'index.html')
        relative = os.path.join(relative, 'index.html')
    if not os.path.isfile(target):
        if '.' not in os.path.basename(relative):
            relative = 'index.html'
        else:
            abort(404)
    response = send_from_directory(PUBLIC_DIR, relative, conditional=True)
    if relative in ('index.html', 'sw.js') or relative.endswith('/index.html'):
        response.headers['Cache-Control'] = 'no-cache'
    elif is_immutable_asset(relative):
        response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    else:
        response.headers['Cache-Control'] = 'public, max-age=3600'
    return response


@app.after_request
def apply_headers(response):
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    response.headers.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
    if COOKIE_SECURE:
        response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Pragma'] = 'no-cache'
    return response


@app.errorhandler(HTTPException)
def handle_http_error(error):
    if request.path.startswith('/api/'):
        return error_response('not_found' if error.code == 404 else 'http_error', error.code or 500)
    return error


if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', '8080')),
        threaded=True,
        use_reloader=False,
        debug=False,
    )
