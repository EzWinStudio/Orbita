'use strict';

const { contextBridge, ipcRenderer, clipboard } = require('electron');

async function invoke(channel, payload) {
  const response = await ipcRenderer.invoke(channel, payload);
  if (!response || response.ok !== true) {
    throw new Error((response && response.error) || 'İşlem başarısız.');
  }
  return response.data;
}

function local(entity, op, input) {
  return invoke('data:local', { entity, op, input });
}

contextBridge.exposeInMainWorld('ezwin', {
  getInitial: () => invoke('state:get'),
  company: {
    create: (data) => invoke('company:create', data),
    update: (data) => invoke('company:update', data),
    remove: (id) => invoke('company:delete', { id }),
  },
  asset: {
    create: (data) => invoke('asset:create', data),
    update: (data) => invoke('asset:update', data),
    remove: (id) => invoke('asset:delete', { id }),
    test: (data) => invoke('asset:test', data),
  },
  task: {
    create: (data) => invoke('task:create', data),
    update: (data) => invoke('task:update', data),
    remove: (id) => invoke('task:delete', { id }),
  },
  note: {
    create: (data) => invoke('note:create', data),
    update: (data) => invoke('note:update', data),
    remove: (id) => invoke('note:delete', { id }),
  },
  finance: {
    create: (data) => invoke('finance:create', data),
    remove: (id) => invoke('finance:delete', { id }),
  },
  salary: {
    create: (data) => local('salary', 'create', data),
    update: (data) => local('salary', 'update', data),
    remove: (id) => local('salary', 'remove', { id }),
  },
  invoice: {
    create: (data) => local('invoice', 'create', data),
    update: (data) => local('invoice', 'update', data),
    remove: (id) => local('invoice', 'remove', { id }),
  },
  customerPayment: {
    create: (data) => local('customerPayment', 'create', data),
    update: (data) => local('customerPayment', 'update', data),
    remove: (id) => local('customerPayment', 'remove', { id }),
  },
  subscription: {
    create: (data) => local('subscription', 'create', data),
    update: (data) => local('subscription', 'update', data),
    remove: (id) => local('subscription', 'remove', { id }),
  },
  chat: {
    createThread: (data) => local('chat', 'createThread', data),
    removeThread: (id) => local('chat', 'removeThread', { id }),
    sendMessage: (data) => local('chat', 'sendMessage', data),
    removeMessage: (id) => local('chat', 'removeMessage', { id }),
  },
  announcement: {
    create: (data) => local('announcement', 'create', data),
    update: (data) => local('announcement', 'update', data),
    remove: (id) => local('announcement', 'remove', { id }),
  },
  meeting: {
    create: (data) => local('meeting', 'create', data),
    update: (data) => local('meeting', 'update', data),
    remove: (id) => local('meeting', 'remove', { id }),
  },
  notification: {
    markRead: (ids) => local('notification', 'markRead', { ids }),
  },
  client: {
    create: (data) => local('client', 'create', data),
    update: (data) => local('client', 'update', data),
    remove: (id) => local('client', 'remove', { id }),
  },
  contract: {
    create: (data) => local('contract', 'create', data),
    update: (data) => local('contract', 'update', data),
    remove: (id) => local('contract', 'remove', { id }),
  },
  document: {
    create: (data) => local('document', 'create', data),
    update: (data) => local('document', 'update', data),
    remove: (id) => local('document', 'remove', { id }),
  },
  bug: {
    create: (data) => local('bug', 'create', data),
    update: (data) => local('bug', 'update', data),
    remove: (id) => local('bug', 'remove', { id }),
  },
  automation: {
    create: (data) => local('automation', 'create', data),
    update: (data) => local('automation', 'update', data),
    remove: (id) => local('automation', 'remove', { id }),
    run: (id) => local('automation', 'run', { id }),
  },
  security: {
    log: (data) => local('security', 'log', data),
    clear: () => local('security', 'clear', {}),
  },
  employee: {
    create: (data) => local('employee', 'create', data),
    update: (data) => local('employee', 'update', data),
    remove: (id) => local('employee', 'remove', { id }),
  },
  department: {
    create: (data) => local('department', 'create', data),
    update: (data) => local('department', 'update', data),
    remove: (id) => local('department', 'remove', { id }),
  },
  role: {
    create: (data) => local('role', 'create', data),
    update: (data) => local('role', 'update', data),
    remove: (id) => local('role', 'remove', { id }),
  },
  performanceReview: {
    create: (data) => local('performanceReview', 'create', data),
    update: (data) => local('performanceReview', 'update', data),
    remove: (id) => local('performanceReview', 'remove', { id }),
  },
  project: {
    create: (data) => local('project', 'create', data),
    update: (data) => local('project', 'update', data),
    remove: (id) => local('project', 'remove', { id }),
  },
  approval: {
    create: (data) => local('approval', 'create', data),
    update: (data) => local('approval', 'update', data),
    remove: (id) => local('approval', 'remove', { id }),
    decide: (id, status, decision) =>
      local('approval', 'decide', { id, status, decision: decision || {} }),
  },
  settings: {
    update: (data) => invoke('settings:update', data),
    testNotification: () => invoke('settings:test-notification'),
  },
  mail: {
    accounts: () => invoke('mail:accounts'),
    test: (data) => invoke('mail:test', data),
    add: (data) => invoke('mail:add', data),
    update: (data) => invoke('mail:update', data),
    remove: (id) => invoke('mail:remove', { id }),
    list: (data) => invoke('mail:list', data),
    read: (data) => invoke('mail:read', data),
    star: (data) => invoke('mail:star', data),
  },
  youtube: {
    addKey: (label, key) => invoke('youtube:add-key', { label, key }),
    updateKey: (id, label) => invoke('youtube:update-key', { id, label }),
    removeKey: (id) => invoke('youtube:remove-key', { id }),
    setDefaultKey: (id) => invoke('youtube:set-default-key', { id }),
    testKey: (data) => invoke('youtube:test-key', data || {}),
    addChannel: (companyId, url, keyId) =>
      invoke('youtube:add-channel', { companyId, url, keyId: keyId || null }),
    setChannelKey: (id, keyId) => invoke('youtube:set-channel-key', { id, keyId }),
    removeChannel: (id) => invoke('youtube:remove-channel', { id }),
    refresh: () => invoke('youtube:refresh'),
  },
  monitor: {
    refresh: () => invoke('monitor:refresh'),
  },
  session: {
    get: () => invoke('session:get'),
    register: (data) => invoke('account:register', data),
    login: (data) => invoke('account:login', data),
    verify2fa: (data) => invoke('account:2fa-verify', data),
    setup2fa: () => invoke('account:2fa-setup'),
    enable2fa: (data) => invoke('account:2fa-enable', data),
    disable2fa: (data) => invoke('account:2fa-disable', data),
    backup2fa: (data) => invoke('account:2fa-backup', data),
    logout: () => invoke('account:logout'),
    update: (data) => invoke('account:update', data),
    changePassword: (data) => invoke('account:password', data),
    security: (data) => invoke('account:security', data),
  },
  assistant: {
    status: () => invoke('assistant:status'),
    ask: (data) => invoke('assistant:ask', data),
  },
  connections: {
    platforms: () => invoke('connections:platforms'),
    add: (data) => invoke('connections:add', data),
    verify: (id) => invoke('connections:verify', { id }),
    refresh: (id) => invoke('connections:refresh', { id }),
    primary: (id) => invoke('connections:primary', { id }),
    remove: (id) => invoke('connections:remove', { id }),
  },
  music: {
    import: () => invoke('music:import'),
    remove: (id) => invoke('music:remove', { id }),
    rename: (data) => invoke('music:rename', data),
  },
  translate: {
    languages: () => invoke('translate:languages'),
    run: (data) => invoke('translate:run', data),
  },
  updates: {
    notes: () => invoke('updates:notes'),
    check: () => invoke('updates:check'),
    markSeen: (version) => invoke('updates:mark-seen', { version }),
    saveSettings: (data) => invoke('updates:settings', data),
    download: () => invoke('updates:download'),
    install: () => invoke('updates:install'),
  },
  rates: {
    get: () => invoke('rates:get'),
    refresh: () => invoke('rates:refresh'),
  },
  app: {
    openExternal: (url) => invoke('app:open-external', { url }),
    exportData: () => invoke('app:export'),
    revealData: () => invoke('app:reveal-data'),
    copyText: (text) => clipboard.writeText(String(text || '')),
  },
  onStatuses: (callback) => {
    const listener = (_event, statuses) => callback(statuses);
    ipcRenderer.on('status:changed', listener);
    return () => ipcRenderer.removeListener('status:changed', listener);
  },
  onYoutube: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('youtube:update', listener);
    return () => ipcRenderer.removeListener('youtube:update', listener);
  },
  onFullscreen: (callback) => {
    const listener = (_event, fullscreen) => callback(Boolean(fullscreen));
    ipcRenderer.on('window:fullscreen', listener);
    return () => ipcRenderer.removeListener('window:fullscreen', listener);
  },
  onMaximized: (callback) => {
    const listener = (_event, maximized) => callback(Boolean(maximized));
    ipcRenderer.on('window:maximized', listener);
    return () => ipcRenderer.removeListener('window:maximized', listener);
  },
  onUpdateAvailable: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updates:available', listener);
    return () => ipcRenderer.removeListener('updates:available', listener);
  },
});
