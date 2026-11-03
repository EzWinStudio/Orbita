export const IMAGE_MAX_BYTES = 6 * 1024 * 1024;

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_DATA_URL_LENGTH = 2_500_000;

interface PrepareOptions {
  width: number;
  height: number;
  fit: 'cover' | 'contain';
}

function isAcceptedImage(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  if (file.type) return false;
  return /\.(png|jpe?g|webp)$/i.test(file.name);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Görsel işlenemedi.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Görsel işlenemedi.'));
    reader.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = await readAsDataUrl(file);
  await image.decode();
  return image;
}

function encode(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.9);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/png');
}

async function prepareImage(file: File, options: PrepareOptions): Promise<string> {
  if (!isAcceptedImage(file)) {
    throw new Error('Bu görsel türü desteklenmiyor. PNG, JPG veya WebP seç.');
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error('Görsel 6 MB sınırını aşıyor.');
  }

  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    throw new Error('Görsel işlenemedi.');
  }

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('Görsel işlenemedi.');

  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Görsel işlenemedi.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const scale =
    options.fit === 'cover'
      ? Math.max(options.width / sourceWidth, options.height / sourceHeight)
      : Math.min(options.width / sourceWidth, options.height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    image,
    (options.width - drawWidth) / 2,
    (options.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const dataUrl = encode(canvas);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error('Görsel çok büyük. Daha küçük bir dosya seç.');
  }
  return dataUrl;
}

export function fileToAvatarDataUrl(file: File): Promise<string> {
  return prepareImage(file, { width: 256, height: 256, fit: 'cover' });
}

export function fileToCompanyLogoDataUrl(file: File): Promise<string> {
  return prepareImage(file, { width: 512, height: 512, fit: 'contain' });
}
