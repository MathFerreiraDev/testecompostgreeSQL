// app.js - Express + pg + SSE + bcrypt login (corrigido wildcard)
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

const DB = process.env.DATABASE_URL;
if(!DB) { console.error('DATABASE_URL missing'); process.exit(1); }

const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const clients = new Map();

(async () => {
  const c = await pool.connect();
  await c.query('LISTEN novodado');
  c.on('notification', m => {
    try {
      const obj = JSON.parse(m.payload);
      const uid = String(obj.usuario_id);
      const set = clients.get(uid);
      if (set) {
        const data = `data: ${JSON.stringify(obj)}\n\n`;
        for (const r of set) r.write(data);
      }
    } catch (e) { console.error('notify parse', e); }
  });
})().catch(e=>{ console.error(e); process.exit(1); });

// login endpoint
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ ok: false, error: 'missing' });
  try {
    const r = await pool.query('SELECT id, email, senha FROM usuarios WHERE email=$1 LIMIT 1', [email]);
    if (!r.rows[0]) return res.json({ ok: false, error: 'invalid' });
    const row = r.rows[0];
    const hash = row.senha;
    const match = await bcrypt.compare(senha, hash);
    if (!match) return res.json({ ok: false, error: 'invalid' });

    const uid = row.id;
    const userEmail = row.email;
    const { rows } = await pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid]);
    const last = rows[0] || null;
    return res.json({ ok: true, uid, email: userEmail, last });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'server' });
  }
});

// SSE endpoint
app.get('/events', (req, res) => {
  const uid = req.query.uid;
  if (!uid) return res.status(400).end('uid missing');

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

  pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid])
    .then(r => res.write(`data: ${JSON.stringify(r.rows[0] || null)}\n\n`))
    .catch(()=> res.write(`data: null\n\n`));

  req.on('close', () => {
    const s = clients.get(key);
    if (s) { s.delete(res); if (s.size===0) clients.delete(key); }
  });
});

// serve static (build React)
app.use(express.static(path.join(__dirname, 'public')));

// CORREÇÃO: usar '/*' (ou /.*/ ) em vez de '*' para evitar erro path-to-regexp
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server listening on', PORT));
