const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'build', 'icon.png');
const out = path.join(root, 'public');

function dibEntry(rgba, size) {
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const srcRow = (size - 1 - y) * size * 4;
    const dstRow = y * size * 4;
    for (let x = 0; x < size; x += 1) {
      const src = srcRow + x * 4;
      const dst = dstRow + x * 4;
      xor[dst] = rgba[src + 2];
      xor[dst + 1] = rgba[src + 1];
      xor[dst + 2] = rgba[src];
      xor[dst + 3] = rgba[src + 3];
    }
  }

  const maskRowBytes = Math.ceil(size / 8);
  const maskRowPadded = Math.ceil(maskRowBytes / 4) * 4;
  const mask = Buffer.alloc(maskRowPadded * size);
  for (let y = 0; y < size; y += 1) {
    const srcRow = (size - 1 - y) * size * 4;
    const dstRow = y * maskRowPadded;
    for (let x = 0; x < size; x += 1) {
      if (rgba[srcRow + x * 4 + 3] === 0) {
        mask[dstRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  const info = Buffer.alloc(40);
  info.writeUInt32LE(40, 0);
  info.writeInt32LE(size, 4);
  info.writeInt32LE(size * 2, 8);
  info.writeUInt16LE(1, 12);
  info.writeUInt16LE(32, 14);
  info.writeUInt32LE(0, 16);
  info.writeUInt32LE(xor.length, 20);

  return Buffer.concat([info, xor, mask]);
}

function icoFromImages(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

async function png(size, name) {
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, name));
}

async function ico() {
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    const { data } = await sharp(source)
      .resize(size, size, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    images.push({ size, data: dibEntry(data, size) });
  }
  fs.writeFileSync(path.join(out, 'favicon.ico'), icoFromImages(images));
}

async function maskable(size, name) {
  const inner = Math.round(size * 0.8);
  const icon = await sharp(source)
    .resize(inner, inner, { fit: 'cover' })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#050807',
    },
  })
    .composite([
      {
        input: icon,
        left: Math.round((size - inner) / 2),
        top: Math.round((size - inner) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, name));
}

async function main() {
  await png(16, 'favicon-16.png');
  await png(32, 'favicon-32.png');
  await png(180, 'favicon-180.png');
  await png(192, 'icon-192.png');
  await png(512, 'icon-512.png');
  await maskable(512, 'maskable-512.png');
  await ico();
  console.log('Web icons generated from build/icon.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
