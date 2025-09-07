// app.js - Express + pg + SSE + login simples + /api/last + logs
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());

const DB = process.env.DATABASE_URL;
if (!DB) { console.error('DATABASE_URL missing'); process.exit(1); }

const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

// SSE clients: Map<uid, Set<res>>
const clients = new Map();

// Postgres LISTEN with logs
(async () => {
  const c = await pool.connect();
  await c.query('LISTEN novodado');
  console.log('[PG] LISTEN novodado active');
  c.on('notification', m => {
    try {
      const obj = JSON.parse(m.payload);
      const uid = String(obj.usuario_id);
      console.log(`[PG] NOTIFY for usuario_id=${uid}:`, obj);
      const set = clients.get(uid);
      if (set) {
        const data = `data: ${JSON.stringify(obj)}\n\n`;
        for (const r of set) {
          try { r.write(data); } catch(e){ /* ignore write errors */ }
        }
      } else {
        console.log(`[PG] no SSE clients for uid=${uid}`);
      }
    } catch (e) { console.error('notify parse', e); }
  });
})().catch(e => { console.error(e); process.exit(1); });

// login (texto simples)
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ ok: false, error: 'missing' });
  try {
    const r = await pool.query('SELECT id, email FROM usuarios WHERE email=$1 AND senha=$2 LIMIT 1', [email, senha]);
    if (!r.rows[0]) {
      console.log(`[LOGIN] email=${email} -> invalid`);
      return res.json({ ok: false, error: 'invalid' });
    }
    const uid = r.rows[0].id;
    const userEmail = r.rows[0].email;
    const { rows } = await pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid]);
    const last = rows[0] || null;
    console.log(`[LOGIN] uid=${uid} email=${userEmail} -> success, last=${last ? JSON.stringify(last) : 'null'}`);
    return res.json({ ok: true, uid, email: userEmail, last });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ ok: false, error: 'server' });
  }
});

// NEW: endpoint para obter o último registro de um usuário
app.get('/api/last', async (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).json({ ok: false, error: 'missing uid' });
  try {
    const { rows } = await pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid]);
    return res.json({ ok: true, last: rows[0] || null });
  } catch (err) {
    console.error('[API /api/last] error', err);
    return res.status(500).json({ ok: false, error: 'server' });
  }
});

// SSE endpoint
app.get('/events', (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).end('uid missing');

  console.log(`[SSE] connect request uid=${uid} from ${req.socket.remoteAddress}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('\n');

  const key = String(uid);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);
  console.log(`[SSE] client added for uid=${key}, totalClients=${clients.get(key).size}`);

  // send last
  pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid])
    .then(r => res.write(`data: ${JSON.stringify(r.rows[0] || null)}\n\n`))
    .catch(() => res.write(`data: null\n\n`));

  req.on('close', () => {
    const s = clients.get(key);
    if (s) { s.delete(res); if (s.size === 0) clients.delete(key); }
    console.log(`[SSE] client closed for uid=${key}`);
  });
});

// serve React build (public) and SPA fallback
app.use(express.static(path.join(__dirname, 'public')));
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server listening on', PORT));
