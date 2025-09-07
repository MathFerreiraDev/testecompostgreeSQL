// app.js - SSE + login dividido em arquivos (login.html + panel.html)
const { Pool } = require('pg');
const http = require('http');
const url = require('url');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');

const DB = process.env.DATABASE_URL;
if (!DB) { console.error('DATABASE_URL missing'); process.exit(1); }
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });

const clients = new Map();

// Postgres LISTEN (mantido)
(async () => {
  const c = await pool.connect();
  await c.query('LISTEN novodado');
  console.log('[PG] LISTEN novodado active');
  c.on('notification', m => {
    try {
      const obj = JSON.parse(m.payload);
      const uid = String(obj.usuario_id);
      const set = clients.get(uid);
      if (set) {
        const data = `data: ${JSON.stringify(obj)}\n\n`;
        for (const r of set) {
          try { r.write(data); } catch(e){ /* ignore write errors */ }
        }
      }
    } catch (e) { console.error('notify parse', e); }
  });
})().catch(e=>{ console.error(e); process.exit(1); });

const publicDir = path.join(__dirname, 'public');
const sendHtml = (res, html) => { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(html); };
const sendFile = (res, filepath, type='text/html') => {
  fs.readFile(filepath, (err, data) => {
    if (err) { res.writeHead(500); return res.end('Server error'); }
    res.writeHead(200, {'Content-Type': type + '; charset=utf-8'});
    res.end(data);
  });
};

const srv = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;
  const q = url.parse(req.url).query ? qs.parse(url.parse(req.url).query) : {};

  // Serve login page
// Serve login page
if (req.method === 'GET' && (p === '/' || p === '/login')) {
  const f = path.join(publicDir, 'login.html');
  return fs.existsSync(f) ? sendFile(res, f) : sendHtml(res, '<p>login page not found</p>');
}


  // Serve panel page
  if (req.method === 'GET' && p === '/panel') {
    const f = path.join(publicDir, 'panel.html');
    return fs.existsSync(f) ? sendFile(res, f) : sendHtml(res, '<p>panel page not found</p>');
  }

  // Static files (login.js, panel.js, css, etc.)
  if (req.method === 'GET' && p.startsWith('/static/')) {
    const f = path.join(publicDir, p.replace('/static/',''));
    const ext = path.extname(f).toLowerCase();
    const mime = ext === '.js' ? 'application/javascript' : (ext === '.css' ? 'text/css' : 'text/plain');
    return fs.existsSync(f) ? sendFile(res, f, mime) : (res.writeHead(404), res.end('Not found'));
  }

  // POST /login (aceita JSON ou form-urlencoded) -> responde JSON
  if (req.method === 'POST' && p === '/login') {
    let body = '';
    req.on('data', c=> body+=c);
    req.on('end', async () => {
      try {
        let email, senha;
        const ct = (req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) {
          const jb = JSON.parse(body || '{}');
          email = jb.email; senha = jb.senha;
        } else {
          const b = qs.parse(body);
          email = b.email; senha = b.senha;
        }

        if (!email || !senha) {
          res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'});
          return res.end(JSON.stringify({ ok: false, error: 'missing' }));
        }

        const r = await pool.query('SELECT id, email FROM usuarios WHERE email=$1 AND senha=$2 LIMIT 1', [email, senha]);
        if (!r.rows[0]) {
          res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
          return res.end(JSON.stringify({ ok: false, error: 'invalid' }));
        }

        const uid = r.rows[0].id;
        const userEmail = r.rows[0].email;

        // quando o cliente faz fetch (JS), esperamos JSON; se for form submit direto, ainda servimos redirect page (compatibilidade)
        const accept = (req.headers['accept'] || '').toLowerCase();
        const isBrowserForm = !ct.includes('application/json') && accept.includes('text/html');

        if (isBrowserForm) {
          // compatibilidade antiga: retorna página que grava localStorage e redireciona
          const redirectHtml = `<!doctype html><meta charset=utf-8><title>Entrando...</title>
            <script>
              localStorage.setItem('uid', ${JSON.stringify(String(uid))});
              localStorage.setItem('email', ${JSON.stringify(String(userEmail))});
              location.href = '/panel';
            </script>`;
          return sendHtml(res, redirectHtml);
        }

        // resposta JSON (usada pelo fetch do login.js)
        const { rows } = await pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid]);
        const last = rows[0] || null;
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'});
        return res.end(JSON.stringify({ ok: true, uid, email: userEmail, last }));
      } catch (err) {
        console.error(err);
        res.writeHead(500, {'Content-Type':'application/json; charset=utf-8'});
        return res.end(JSON.stringify({ ok: false, error: 'server' }));
      }
    });
    return;
  }

  // SSE endpoint (mantido)
  if (p === '/events') {
    const uid = q.uid;
    if (!uid) { res.writeHead(400); return res.end('uid missing'); }

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

    try {
      const { rows } = await pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid]);
      const last = rows[0] || null;
      res.write(`data: ${JSON.stringify(last)}\n\n`);
    } catch (e) { res.write(`data: null\n\n`); }

    req.on('close', () => {
      const s = clients.get(key);
      if (s) { s.delete(res); if (s.size === 0) clients.delete(key); }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

const PORT = process.env.PORT || 3000;
srv.listen(PORT, ()=>console.log('Rodando na porta', PORT));
