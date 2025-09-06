// app.js - SSE + login simples (compacto) - já com seu DB como fallback
const { Pool } = require('pg');
const http = require('http');
const url = require('url');
const qs = require('querystring');

const DB = 'postgresql://postgres:KnORKdSwxRMHJeaFIgsopaTHmrCbszLD@hopper.proxy.rlwy.net:18352/railway';
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

const sendHtml = (res, html) => { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(html); };

const srv = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;
  const q = url.parse(req.url).query ? qs.parse(url.parse(req.url).query) : {};

  if (req.method === 'GET' && p === '/') {
    return sendHtml(res, `<!doctype html><meta charset=utf-8><title>Login</title>
      <style>body{font-family:Arial;display:flex;align-items:center;justify-content:center;height:100vh}</style>
      <form method="POST" action="/login">
        <h3>Login</h3>
        <input name="email" placeholder="email" required><br><br>
        <input name="senha" placeholder="senha" type="password" required><br><br>
        <button>Entrar</button>
      </form>`);
  }

  if (req.method === 'POST' && p === '/login') {
    let body = '';
    req.on('data', c=> body+=c);
    req.on('end', async () => {
      const b = qs.parse(body);
      try {
        const r = await pool.query('SELECT id FROM usuarios WHERE email=$1 AND senha=$2 LIMIT 1', [b.email, b.senha]);
        if (!r.rows[0]) return sendHtml(res, '<p>Credenciais inválidas. <a href="/">Voltar</a></p>');
        const uid = r.rows[0].id;
        const { rows } = await pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid]);
        const last = rows[0] || null;
        return sendHtml(res, `<!doctype html><meta charset=utf-8><title>Painel</title>
          <style>body{font-family:Arial;padding:20px}</style>
          <h3>Bem-vindo (user ${uid})</h3>
          <div>ÚLTIMO REGISTRO:</div>
          <pre id="v">${last ? JSON.stringify(last, null, 2) : 'nenhum registro'}</pre>
          <script>
            const uid=${JSON.stringify(String(uid))};
            const es = new EventSource('/events?uid='+uid);
            es.onmessage = e => { const obj = JSON.parse(e.data); document.getElementById('v').textContent = JSON.stringify(obj, null, 2); };
          </script>
          <p><a href="/">Sair</a></p>`);
      } catch (err) { console.error(err); sendHtml(res, '<p>Erro no servidor.</p>'); }
    });
    return;
  }

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
      res.write(`data: ${JSON.stringify(rows[0] || null)}\n\n`);
    } catch (e) { res.write(`data: null\n\n`); }

    req.on('close', () => {
      const s = clients.get(key);
      if (s) { s.delete(res); if (s.size===0) clients.delete(key); }
    });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

const PORT = process.env.PORT || 3000;
srv.listen(PORT, ()=>console.log('Rodando na porta', PORT));
