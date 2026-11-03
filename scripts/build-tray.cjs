const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = '1.0.9';
const version4 = '1.0.9.0';
const sdkVersion = '1.0.4314.35';
const trayRoot = path.join(root, 'tray');
const webDist = path.join(root, 'web-dist');
const outputRoot = path.join(root, 'release-artifacts-tray');
const stage = path.join(outputRoot, 'app');
const exeName = 'EZWIN HUB Tray.exe';
const cacheRoot = path.join(root, '.build-cache', 'webview2');
const sdkRoot = path.join(cacheRoot, 'sdk');
const framework = path.join(process.env.SystemRoot || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');
const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');

function fail(message) {
  console.error(`\n[build-tray] ${message}\n`);
  process.exit(1);
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function ensureWebBuild() {
  if (!fs.existsSync(path.join(webDist, 'index.html'))) {
    fail('web-dist bulunamadı. Önce "npm run build:web" çalıştır.');
  }
}

function download(url, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  console.log(`[build-tray] indiriliyor: ${url}`);
  execFileSync('curl.exe', ['-sS', '-L', '--fail', '-o', target, url], { stdio: 'inherit' });
}

function ensureSdk() {
  const core = path.join(sdkRoot, 'lib', 'net462', 'Microsoft.Web.WebView2.Core.dll');
  if (fs.existsSync(core)) return;
  const nupkg = path.join(cacheRoot, `microsoft.web.webview2.${sdkVersion}.nupkg`);
  if (!fs.existsSync(nupkg)) {
    download(
      `https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${sdkVersion}/microsoft.web.webview2.${sdkVersion}.nupkg`,
      nupkg,
    );
  }
  fs.rmSync(sdkRoot, { recursive: true, force: true });
  fs.mkdirSync(sdkRoot, { recursive: true });
  execFileSync(tar, ['-xf', nupkg, '-C', sdkRoot], { stdio: 'inherit' });
}

function findFile(directory, fileName, depth = 0) {
  if (depth > 8) return null;
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return path.join(directory, entry.name);
    }
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = findFile(path.join(directory, entry.name), fileName, depth + 1);
    if (found) return found;
  }
  return null;
}

function findMakensis() {
  if (process.env.MAKENSIS && fs.existsSync(process.env.MAKENSIS)) return process.env.MAKENSIS;
  const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache');
  const cached = findFile(cache, 'makensis.exe');
  if (cached) return cached;
  const candidates = [
    'C:\\Program Files (x86)\\NSIS\\makensis.exe',
    'C:\\Program Files\\NSIS\\makensis.exe',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function stageApp() {
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  fs.cpSync(webDist, path.join(stage, 'web'), { recursive: true });
  copyFile(path.join(webDist, 'favicon.ico'), path.join(stage, 'ezwin.ico'));
  copyFile(
    path.join(sdkRoot, 'lib', 'net462', 'Microsoft.Web.WebView2.Core.dll'),
    path.join(stage, 'Microsoft.Web.WebView2.Core.dll'),
  );
  copyFile(
    path.join(sdkRoot, 'lib', 'net462', 'Microsoft.Web.WebView2.WinForms.dll'),
    path.join(stage, 'Microsoft.Web.WebView2.WinForms.dll'),
  );
  copyFile(
    path.join(sdkRoot, 'build', 'native', 'x64', 'WebView2Loader.dll'),
    path.join(stage, 'WebView2Loader.dll'),
  );
  copyFile(path.join(trayRoot, 'app.config'), path.join(stage, `${exeName}.config`));
}

function compile() {
  const csc = path.join(framework, 'csc.exe');
  if (!fs.existsSync(csc)) fail(`C# derleyicisi bulunamadı: ${csc}`);
  const sources = fs
    .readdirSync(trayRoot)
    .filter((name) => name.endsWith('.cs'))
    .sort()
    .map((name) => path.join(trayRoot, name));
  const references = [
    'System.dll',
    'System.Core.dll',
    'System.Drawing.dll',
    'System.Windows.Forms.dll',
    'System.Net.Http.dll',
    'System.Security.dll',
    'System.Web.Extensions.dll',
  ].map((name) => path.join(framework, name));
  references.push(path.join(stage, 'Microsoft.Web.WebView2.Core.dll'));
  references.push(path.join(stage, 'Microsoft.Web.WebView2.WinForms.dll'));

  const args = [
    '/nologo',
    '/target:winexe',
    '/platform:x64',
    '/langversion:5',
    '/optimize+',
    `/win32icon:${path.join(stage, 'ezwin.ico')}`,
    `/win32manifest:${path.join(trayRoot, 'app.manifest')}`,
    `/out:${path.join(stage, exeName)}`,
    ...references.map((reference) => `/r:${reference}`),
    ...sources,
  ];
  console.log('[build-tray] C# derleniyor');
  const result = spawnSync(csc, args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    console.error(result.stdout || '');
    console.error(result.stderr || '');
    fail('C# derlemesi başarısız.');
  }
}

function buildZip() {
  const zip = path.join(outputRoot, `EZWIN-HUB-Tray-${version}-portable.zip`);
  fs.rmSync(zip, { force: true });
  execFileSync(tar, ['-a', '-c', '-f', zip, '-C', stage, '.'], { stdio: 'inherit' });
  return zip;
}

function buildInstaller() {
  const makensis = findMakensis();
  if (!makensis) fail('makensis.exe bulunamadı. NSIS kurulumu gerekli.');
  const installer = path.join(outputRoot, `EZWIN-HUB-Tray-Setup-${version}.exe`);
  fs.rmSync(installer, { force: true });
  console.log('[build-tray] NSIS paketi hazırlanıyor');
  const result = spawnSync(
    makensis,
    [
      '/NOCD',
      `/DVERSION=${version}`,
      `/DVERSION4=${version4}`,
      `/DSRCDIR=${stage}`,
      `/DOUTFILE=${installer}`,
      `/DICONFILE=${path.join(stage, 'ezwin.ico')}`,
      path.join(root, 'installer', 'tray.nsi'),
    ],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) {
    console.error(result.stdout || '');
    console.error(result.stderr || '');
    fail('NSIS derlemesi başarısız.');
  }
  return installer;
}

function sizeLabel(file) {
  const bytes = fs.statSync(file).size;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function main() {
  ensureWebBuild();
  ensureSdk();
  stageApp();
  compile();
  const zip = buildZip();
  const installer = buildInstaller();
  const exe = path.join(stage, exeName);
  console.log('\n[build-tray] hazır');
  console.log(`  exe       ${exe} (${sizeLabel(exe)})`);
  console.log(`  taşınabilir ${zip} (${sizeLabel(zip)})`);
  console.log(`  kurulum   ${installer} (${sizeLabel(installer)})`);
}

main();
