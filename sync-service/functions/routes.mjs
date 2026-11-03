const CHANNEL_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;
const MAX_PAYLOAD = 600_000;
const MAX_BODY = 620_000;

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

export function application({ db, BackendError }) {
  const fail = (code, status) => {
    throw new BackendError(code, status);
  };
  const rows = (result) => {
    if (result.error) fail(result.error.code, result.error.status);
    return result.data;
  };
  const json = (body, status = 200) => cors(Response.json(body, { status }));

  async function input(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) {
      fail('invalid_input', 400);
    }
    const reader = request.body?.getReader();
    if (!reader) fail('invalid_input', 400);
    let size = 0;
    const chunks = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BODY) {
          await reader.cancel();
          fail('payload_too_large', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      fail('invalid_input', 400);
    }
  }

  async function current(channel) {
    const found = rows(
      await db
        .from('sync_blobs')
        .select('channel_id,payload,version,updated_at')
        .eq('channel_id', channel)
        .limit(1),
    );
    return found?.[0] ?? null;
  }

  return async (ctx) => {
    const request = ctx.request;
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }
    const pathname = new URL(request.url).pathname;
    const match = pathname.match(/^\/(?:functions\/v1\/)?(?:app|app-d[0-9a-f]{32})(\/.*)?$/);
    if (!match) fail('not_found', 404);

    if (request.method === 'GET') {
      const channel = new URL(request.url).searchParams.get('channel') || '';
      if (!CHANNEL_PATTERN.test(channel)) fail('invalid_channel', 400);
      const row = await current(channel);
      if (!row) {
        return json({ ok: true, found: false, version: 0, updatedAt: 0 });
      }
      return json({
        ok: true,
        found: true,
        payload: row.payload,
        version: Number(row.version),
        updatedAt: Number(row.updated_at),
      });
    }

    if (request.method === 'PUT') {
      const body = await input(request);
      const channel = typeof body?.channel === 'string' ? body.channel : '';
      const payload = typeof body?.payload === 'string' ? body.payload : '';
      const expectedVersion = body?.expectedVersion;
      const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.slice(0, 80) : '';
      if (!CHANNEL_PATTERN.test(channel)) fail('invalid_channel', 400);
      if (!payload || payload.length > MAX_PAYLOAD) fail('invalid_payload', 422);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0 || expectedVersion > 2_000_000_000) {
        fail('invalid_version', 400);
      }

      const now = Date.now();
      if (expectedVersion === 0) {
        const inserted = rows(
          await db
            .from('sync_blobs')
            .insertIfAbsent(
              {
                channel_id: channel,
                payload,
                version: 1,
                updated_at: now,
                device_id: deviceId,
              },
              { onConflict: 'channel_id' },
            )
            .select('version,updated_at'),
        );
        if (inserted?.length) {
          return json({
            ok: true,
            version: Number(inserted[0].version),
            updatedAt: Number(inserted[0].updated_at),
          });
        }
        const existing = await current(channel);
        return json(
          {
            ok: false,
            code: 'sync_conflict',
            version: existing ? Number(existing.version) : 0,
            updatedAt: existing ? Number(existing.updated_at) : 0,
          },
          409,
        );
      }

      const updated = rows(
        await db
          .from('sync_blobs')
          .update({ payload, version: expectedVersion + 1, updated_at: now, device_id: deviceId })
          .eq('channel_id', channel)
          .eq('version', expectedVersion)
          .select('version,updated_at'),
      );
      if (!updated?.length) {
        const existing = await current(channel);
        return json(
          {
            ok: false,
            code: 'sync_conflict',
            version: existing ? Number(existing.version) : 0,
            updatedAt: existing ? Number(existing.updated_at) : 0,
          },
          409,
        );
      }
      return json({
        ok: true,
        version: Number(updated[0].version),
        updatedAt: Number(updated[0].updated_at),
      });
    }

    fail('method_not_allowed', 405);
  };
}
