'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const handlers = new Set();

ipcRenderer.on('orbita:host-message', (_event, payload) => {
  for (const handler of Array.from(handlers)) {
    try {
      handler({ data: payload });
    } catch {
      /* a broken listener must not stop the others */
    }
  }
});

function subscribe(handler) {
  if (typeof handler !== 'function') return () => {};
  handlers.add(handler);
  return () => handlers.delete(handler);
}

contextBridge.exposeInMainWorld('ezwinHost', {
  postMessage: (message) => {
    if (typeof message === 'string') ipcRenderer.send('orbita:web-message', message);
  },
  onMessage: subscribe,
  addEventListener: (type, handler) => {
    if (type === 'message') subscribe(handler);
  },
  removeEventListener: (type, handler) => {
    if (type === 'message') handlers.delete(handler);
  },
  copyText: (text) =>
    ipcRenderer
      .invoke('orbita:copy-text', String(text ?? ''))
      .then((ok) => ok === true)
      .catch(() => false),
  updates: {
    status: () => ipcRenderer.invoke('orbita:update-status').catch(() => null),
    check: () => ipcRenderer.invoke('orbita:update-check').catch(() => null),
    install: () => ipcRenderer.invoke('orbita:update-install').catch(() => ({ ok: false })),
  },
});
