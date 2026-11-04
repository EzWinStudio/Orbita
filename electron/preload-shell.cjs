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
});
