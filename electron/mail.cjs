'use strict';

const { ImapFlow } = require('imapflow');
const { htmlToText } = require('html-to-text');

const HOST = 'imap.gmail.com';
const PORT = 993;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const MAX_BODY_BYTES = 512 * 1024;
const MAX_TEXT_CHARS = 250000;

function createClient(email, password) {
  return new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: { minVersion: 'TLSv1.2' },
  });
}

function classifyError(err) {
  const raw = `${(err && err.responseText) || ''} ${(err && err.message) || ''}`;
  if (/AUTHENTICATIONFAILED|Invalid credentials|LOGIN failed|Authentication failed|AUTHENTICATE/i.test(raw)) {
    return 'auth';
  }
  if (/application-specific password|app password|Web login required/i.test(raw)) {
    return 'app-password';
  }
  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|timeout|socket hang up|ECONNRESET/i.test(raw)) {
    return 'network';
  }
  if (/certificate|TLS|SSL/i.test(raw)) return 'tls';
  if (/Mailbox does not exist|NONEXISTENT|not found/i.test(raw)) return 'mailbox';
  return 'unknown';
}

function friendlyError(err) {
  switch (classifyError(err)) {
    case 'auth':
      return 'Gmail girişi reddedildi. Uygulama şifresini kontrol et.';
    case 'app-password':
      return 'Gmail uygulama şifresi gerekiyor. Google hesabında 2 adımlı doğrulamayı açıp yeni bir uygulama şifresi oluştur.';
    case 'network':
      return 'Gmail sunucusuna bağlanılamadı. İnternet bağlantısını kontrol et.';
    case 'tls':
      return 'Gmail ile güvenli bağlantı kurulamadı.';
    case 'mailbox':
      return 'İstenen Gmail klasörü bu hesapta bulunamadı.';
    default:
      return 'Gmail bağlantısı başarısız. Tekrar dene.';
  }
}

function userError(message) {
  const error = new Error(message);
  error.mailFriendly = true;
  return error;
}

async function withClient(email, password, fn) {
  const client = createClient(email, password);
  try {
    await client.connect();
    return await fn(client);
  } catch (err) {
    if (err && err.mailFriendly) throw err;
    const code = classifyError(err);
    const friendly = new Error(friendlyError(err));
    friendly.mailCode = code;
    throw friendly;
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {
        /* connection is already gone */
      }
    }
  }
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapAddresses(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : '',
      address: typeof item.address === 'string' ? item.address.trim() : '',
    }))
    .filter((item) => item.name || item.address);
}

function partFilename(part) {
  if (!part) return '';
  const params = part.dispositionParameters || {};
  if (typeof params.filename === 'string') return params.filename;
  const typeParams = part.parameters || {};
  if (typeof typeParams.name === 'string') return typeParams.name;
  return '';
}

function walkParts(node, visit) {
  if (!node) return;
  visit(node);
  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) walkParts(child, visit);
  }
}

function collectAttachments(structure) {
  const attachments = [];
  walkParts(structure, (part) => {
    const filename = partFilename(part);
    const disposition = String(part.disposition || '').toLowerCase();
    const isText = String(part.type || '').startsWith('text/');
    if (!filename) return;
    if (disposition === 'attachment' || (!isText && disposition !== 'inline')) {
      attachments.push({
        filename,
        size: typeof part.size === 'number' ? part.size : null,
        contentType: part.type || 'application/octet-stream',
      });
    }
  });
  return attachments;
}

function findTextPart(structure) {
  const plain = [];
  const html = [];
  walkParts(structure, (part) => {
    const disposition = String(part.disposition || '').toLowerCase();
    if (disposition === 'attachment' || partFilename(part)) return;
    if (part.type === 'text/plain') plain.push(part);
    if (part.type === 'text/html') html.push(part);
  });
  return plain[0] || html[0] || null;
}

async function resolveMailbox(client, kind) {
  if (kind === 'inbox') return 'INBOX';
  const wanted =
    kind === 'all' ? '\\All' : kind === 'starred' ? '\\Flagged' : '\\Sent';
  const folders = await client.list();
  const special = folders.find((folder) => folder.specialUse === wanted);
  if (special) return special.path;
  const fallbacks =
    kind === 'all'
      ? ['[gmail]/all mail', '[google mail]/all mail', 'all mail']
      : kind === 'starred'
        ? ['[gmail]/starred', '[google mail]/starred', 'starred']
        : ['[gmail]/sent mail', '[google mail]/sent mail', 'sent'];
  const named = folders.find((folder) => {
    const path = folder.path.toLowerCase();
    return fallbacks.some((item) => path === item || path.endsWith(`/${item}`));
  });
  if (named) return named.path;
  throw userError('Bu Gmail klasörü bulunamadı.');
}

function mapSummary(message, accountId, mailbox) {
  const envelope = message.envelope || {};
  const flags = message.flags instanceof Set ? message.flags : new Set();
  return {
    uid: message.uid,
    accountId,
    mailbox,
    subject: typeof envelope.subject === 'string' ? envelope.subject : '',
    from: mapAddresses(envelope.from),
    date: toIso(envelope.date) || toIso(message.internalDate),
    unread: !flags.has('\\Seen'),
    starred: flags.has('\\Flagged'),
    hasAttachments: collectAttachments(message.bodyStructure).length > 0,
    size: typeof message.size === 'number' ? message.size : null,
  };
}

async function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', (chunk) => {
      total += chunk.length;
      if (total <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

async function test(email, password) {
  try {
    await withClient(email, password, async (client) => {
      await client.status('INBOX', { unseen: true });
    });
    return { ok: true, message: 'Gmail bağlantısı doğrulandı.' };
  } catch (err) {
    return {
      ok: false,
      message: err && err.mailCode ? err.message : friendlyError(err),
    };
  }
}

async function listAccount(account, password, options) {
  return withClient(account.email, password, async (client) => {
    const mailbox = await resolveMailbox(client, options.mailbox || 'inbox');
    let unreadCount = 0;
    try {
      const status = await client.status('INBOX', { unseen: true });
      unreadCount = typeof status?.unseen === 'number' ? status.unseen : 0;
    } catch {
      unreadCount = 0;
    }

    const lock = await client.getMailboxLock(mailbox);
    try {
      const query = String(options.query || '').trim();
      const filters = [];
      if (options.filter === 'unread') filters.push('is:unread');
      if (options.filter === 'starred') filters.push('is:starred');
      if (options.filter === 'attachments') filters.push('has:attachment');
      const criteria = query || filters.length
        ? { gmraw: [query, ...filters].filter(Boolean).join(' ') }
        : { all: true };

      let uids = await client.search(criteria, { uid: true });
      if (!Array.isArray(uids)) uids = [];
      uids.sort((a, b) => a - b);
      const limit = Math.min(
        Math.max(Number(options.limit) || DEFAULT_LIMIT, 1),
        MAX_LIMIT,
      );
      const selected = uids.slice(-limit);

      let summaries = [];
      if (selected.length) {
        const messages = await client.fetchAll(
          selected,
          {
            uid: true,
            envelope: true,
            flags: true,
            size: true,
            bodyStructure: true,
            internalDate: true,
          },
          { uid: true },
        );
        summaries = messages.map((message) => mapSummary(message, account.id, mailbox));
      }
      summaries.sort((a, b) => {
        const aTime = a.date ? Date.parse(a.date) : 0;
        const bTime = b.date ? Date.parse(b.date) : 0;
        return bTime - aTime;
      });
      return { messages: summaries, unreadCount };
    } finally {
      lock.release();
    }
  });
}

async function readAccount(account, password, input) {
  return withClient(account.email, password, async (client) => {
    const lock = await client.getMailboxLock(input.mailbox);
    try {
      const message = await client.fetchOne(
        input.uid,
        {
          uid: true,
          envelope: true,
          flags: true,
          size: true,
          bodyStructure: true,
          internalDate: true,
        },
        { uid: true },
      );
      if (!message) throw userError('Mail bulunamadı.');

      const structure = message.bodyStructure;
      const textPart = findTextPart(structure);
      let text = '';
      let truncated = false;
      if (textPart) {
        const partId = textPart.part || '1';
        const download = await client.download(input.uid, partId, {
          uid: true,
          maxBytes: MAX_BODY_BYTES,
        });
        if (download.content) {
          const raw = await collectStream(download.content);
          if (textPart.type === 'text/html') {
            text = htmlToText(raw, {
              wordwrap: 120,
              selectors: [
                { selector: 'a', options: { ignoreHref: false } },
                { selector: 'img', format: 'skip' },
              ],
            });
            truncated = Buffer.byteLength(raw, 'utf8') >= MAX_BODY_BYTES;
          } else {
            text = raw;
            truncated = Buffer.byteLength(raw, 'utf8') >= MAX_BODY_BYTES;
          }
        }
      }

      const summary = mapSummary(message, account.id, input.mailbox);
      const flags = message.flags instanceof Set ? message.flags : new Set();
      if (!flags.has('\\Seen')) {
        try {
          await client.messageFlagsAdd(input.uid, ['\\Seen'], { uid: true });
        } catch {
          /* reading the message still succeeds even if flagging fails */
        }
      }

      const envelope = message.envelope || {};
      return {
        ...summary,
        unread: false,
        to: mapAddresses(envelope.to),
        cc: mapAddresses(envelope.cc),
        text: text.trim().slice(0, MAX_TEXT_CHARS),
        truncated,
        attachments: collectAttachments(structure),
      };
    } finally {
      lock.release();
    }
  });
}

async function starAccount(account, password, input) {
  return withClient(account.email, password, async (client) => {
    const lock = await client.getMailboxLock(input.mailbox);
    try {
      if (input.starred) {
        await client.messageFlagsAdd(input.uid, ['\\Flagged'], { uid: true });
      } else {
        await client.messageFlagsRemove(input.uid, ['\\Flagged'], { uid: true });
      }
      return Boolean(input.starred);
    } finally {
      lock.release();
    }
  });
}

module.exports = { test, listAccount, readAccount, starAccount };
