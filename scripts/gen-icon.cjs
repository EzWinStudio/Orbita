const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');

const svg = path.join(__dirname, '..', 'build', 'icon.svg');
const out = path.join(__dirname, '..', 'build', 'icon.png');
const runtimeOut = path.join(__dirname, '..', 'electron', 'assets', 'icon.png');

if (!fs.existsSync(svg)) {
  console.error('icon.svg bulunamadı');
  process.exit(1);
}

sharp(svg, { density: 300 })
  .resize(1024, 1024)
  .png()
  .toFile(out)
  .then(() => {
    fs.mkdirSync(path.dirname(runtimeOut), { recursive: true });
    fs.copyFileSync(out, runtimeOut);
    console.log('build/icon.png ve electron/assets/icon.png hazır');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
