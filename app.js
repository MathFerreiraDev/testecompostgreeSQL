// app.js - SSE + login simples (compacto) - mostra email no <h2>
const { Pool } = require('pg');
const http = require('http');
const url = require('url');
const qs = require('querystring');

const DB = process.env.DATABASE_URL;
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
      <style>body{font-family:Arial;display:flex;align-items:center;justify-content:center;height:100vh}form{width:260px}</style>
      <form method="POST" action="/login">
        <h3>Login</h3>
        <input name="email" placeholder="email" required style="width:100%"><br><br>
        <input name="senha" placeholder="senha" type="password" required style="width:100%"><br><br>
        <button style="width:100%">Entrar</button>
      </form>`);
  }

  if (req.method === 'POST' && p === '/login') {
    let body = '';
    req.on('data', c=> body+=c);
    req.on('end', async () => {
      const b = qs.parse(body);
      try {
        // pegamos id E email aqui
        const r = await pool.query('SELECT id, email FROM usuarios WHERE email=$1 AND senha=$2 LIMIT 1', [b.email, b.senha]);
        if (!r.rows[0]) return sendHtml(res, '<p>Credenciais inválidas. <a href="/">Voltar</a></p>');
        const uid = r.rows[0].id;
        const userEmail = r.rows[0].email;
        const { rows } = await pool.query('SELECT * FROM reservatorios WHERE usuario_id=$1 ORDER BY id DESC LIMIT 1', [uid]);
        const last = rows[0] || null;

        return sendHtml(res, `<!doctype html><meta charset=utf-8><title>Painel</title>
          <style>body{font-family:Arial;padding:20px;max-width:720px;margin:auto} .box{background:#f7f7f7;padding:12px;border-radius:6px}</style>
          <h2 id="user">Bem-vindo</h2>
          <div class="box">
            <div>ÚLTIMO REGISTRO:</div>
            <h3 id="nivel">Nível: ${last ? last.nivel : '—'}</h3>
            <h3 id="temperatura">Temperatura: ${last ? last.temperatura : '—'}</h3>
            <h3 id="ph">pH: ${last ? last.ph : '—'}</h3>
            <h3 id="cloro">Cloro: ${last ? last.cloro : '—'}</h3>
          </div>

          <script>
            const uid=${JSON.stringify(String(uid))};
            const userEmail=${JSON.stringify(String(userEmail))};
            document.getElementById('user').textContent = 'Bem-vindo — ' + userEmail;

            const setField = (id, v) => document.getElementById(id).textContent =
              id === 'ph' ? ('pH: ' + (v===null ? '—' : v)) :
              (id==='nivel' ? ('Nível: ' + (v===null ? '—' : v)) :
              (id==='temperatura' ? ('Temperatura: ' + (v===null ? '—' : v)) : ('Cloro: ' + (v===null ? '—' : v))));

            const es = new EventSource('/events?uid='+uid);
            es.onmessage = e => {
              try {
                const obj = JSON.parse(e.data);
                if (!obj) { setField('nivel', null); setField('temperatura', null); setField('ph', null); setField('cloro', null); return; }
                setField('nivel', obj.nivel);
                setField('temperatura', obj.temperatura);
                setField('ph', obj.ph);
                setField('cloro', obj.cloro);
              } catch (err) { console.error(err); }
            };
            es.onerror = err => console.error('EventSource erro', err);
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
      const last = rows[0] || null;
      res.write(`data: ${JSON.stringify(last)}\n\n`);
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
