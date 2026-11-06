const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const source = path.join(root, 'web-dist');
const target = path.join(root, '.build-cache', 'android-web');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, {
  recursive: true,
  filter: (item) => {
    const relative = path.relative(source, item).replace(/\\/g, '/');
    return relative !== 'download' && !relative.startsWith('download/');
  },
});

const result = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'],
  {
    cwd: root,
    env: { ...process.env, ORBITA_ANDROID_WEB: target },
    stdio: 'inherit',
  },
);

if (result.status !== 0) process.exit(result.status ?? 1);
