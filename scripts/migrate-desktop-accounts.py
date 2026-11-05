import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_DIR = os.path.join(ROOT, 'sites', 'orbita', 'server')
sys.path.insert(0, SERVER_DIR)
sys.path.insert(0, os.path.join(SERVER_DIR, 'vendor'))

import orbita_auth as auth


def load_env_file(path):
    values = {}
    with open(path, encoding='utf-8') as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            values[key.strip()] = value
    return values


def database_env(app_name, env_file):
    if env_file:
        values = load_env_file(env_file)
    else:
        result = subprocess.run(
            ['wasmer', 'app', 'database', 'list', app_name, '-f', 'json', '--with-password'],
            capture_output=True,
            text=True,
            encoding='utf-8',
        )
        if result.returncode != 0:
            raise RuntimeError('database lookup failed')
        try:
            records = json.loads(result.stdout)
            record = records[0]
            values = {
                'DB_HOST': record['host'],
                'DB_PORT': str(record['port']),
                'DB_NAME': record['name'],
                'DB_USERNAME': record['username'],
                'DB_PASSWORD': record['password'],
            }
        except (ValueError, KeyError, IndexError):
            raise RuntimeError('database lookup failed')
    for key in ('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'):
        if not values.get(key):
            raise RuntimeError('database configuration incomplete')
    return values


def read_accounts(path):
    with open(path, encoding='utf-8') as handle:
        raw = json.load(handle)
    accounts = raw.get('accounts') if isinstance(raw, dict) else None
    if not isinstance(accounts, list):
        raise RuntimeError('accounts file invalid')
    return accounts


def main():
    parser = argparse.ArgumentParser(description='Orbita desktop accounts -> Wasmer MySQL')
    parser.add_argument('--account-file', default=os.path.join(os.environ.get('APPDATA', ''), 'EZWIN HUB', 'accounts.json'))
    parser.add_argument('--app', default='ezwinstudio/orbita')
    parser.add_argument('--env-file')
    args = parser.parse_args()

    env = database_env(args.app, args.env_file)
    os.environ.update(env)
    accounts = read_accounts(args.account_file)
    counts = {'inserted': 0, 'updated': 0, 'conflict': 0, 'invalid': 0}
    two_factor = 0

    connection = auth.connect()
    try:
        auth.ensure_schema(connection)
        for account in accounts:
            result = auth.import_desktop_account(connection, account if isinstance(account, dict) else {})
            status = result.get('status', 'invalid')
            counts[status] = counts.get(status, 0) + 1
            if isinstance(account, dict) and account.get('twoFactor', {}).get('enabled'):
                two_factor += 1
    finally:
        connection.close()

    print(json.dumps({
        'accounts': len(accounts),
        'inserted': counts['inserted'],
        'updated': counts['updated'],
        'conflict': counts['conflict'],
        'invalid': counts['invalid'],
        'two_factor_enabled': two_factor,
        'source': 'desktop',
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': type(error).__name__}))
        sys.exit(1)
