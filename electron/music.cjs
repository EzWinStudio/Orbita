'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { dialog } = require('electron');

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.wav',
  '.ogg',
  '.oga',
  '.flac',
  '.aac',
  '.opus',
  '.weba',
]);

const MIME_BY_EXT = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.weba': 'audio/webm',
};

const MAX_BYTES = 60 * 1024 * 1024;

function musicDir(profileDir) {
  const dir = path.join(profileDir, 'music');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function trackPath(profileDir, file) {
  const safe = path.basename(String(file || ''));
  if (!safe || safe.startsWith('.')) throw new Error('Geçersiz müzik dosyası.');
  return path.join(musicDir(profileDir), safe);
}

async function importTracks({ win, profileDir, store }) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Müzik ekle',
    buttonLabel: 'Listeye ekle',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Ses dosyaları', extensions: [...AUDIO_EXTENSIONS].map((ext) => ext.slice(1)) },
      { name: 'Tüm dosyalar', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return { added: [], skipped: [] };

  const dir = musicDir(profileDir);
  const added = [];
  const skipped = [];

  for (const source of result.filePaths.slice(0, 25)) {
    const extension = path.extname(source).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(extension)) {
      skipped.push(path.basename(source));
      continue;
    }
    const { size } = fs.statSync(source);
    if (size > MAX_BYTES) {
      skipped.push(path.basename(source));
      continue;
    }
    const id = crypto.randomUUID();
    const file = `${id}${extension}`;
    fs.copyFileSync(source, path.join(dir, file));
    const title = path.basename(source, extension).replace(/[_-]+/g, ' ').trim() || 'Parça';
    const track = {
      id,
      title: title.slice(0, 120),
      artist: '',
      file,
      mime: MIME_BY_EXT[extension] || 'audio/mpeg',
      size,
      addedAt: Date.now(),
    };
    store.get().playlist.unshift(track);
    added.push(track);
  }

  if (added.length > 0) store.save();
  return { added, skipped };
}

function removeTrack({ profileDir, store, id }) {
  const list = store.get().playlist;
  const index = list.findIndex((track) => track.id === id);
  if (index === -1) throw new Error('Parça bulunamadı.');
  const [track] = list.splice(index, 1);
  try {
    fs.rmSync(trackPath(profileDir, track.file), { force: true });
  } catch {
    /* the row is what matters */
  }
  store.save();
  return true;
}

function renameTrack({ store, id, title, artist }) {
  const track = store.get().playlist.find((item) => item.id === id);
  if (!track) throw new Error('Parça bulunamadı.');
  if (typeof title === 'string' && title.trim()) track.title = title.trim().slice(0, 120);
  if (typeof artist === 'string') track.artist = artist.trim().slice(0, 120);
  store.save();
  return track;
}

module.exports = { importTracks, removeTrack, renameTrack, musicDir, trackPath, MAX_BYTES };
