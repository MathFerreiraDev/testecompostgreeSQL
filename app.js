// app.js - compacto SSE + LISTEN/NOTIFY (HTTPS)
const { Pool } = require('pg'), https = require('https'), fs = require('fs');
const DB = process.env.DATABASE_URL || 'postgresql://postgres:vfqipiyXckgfwRowbRHiuNJkhETzPnTE@gondola.proxy.rlwy.net:37016/railway';
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const clients = new Set();

(async () => {
  const c = await pool.connect();
  await c.query('LISTEN novodado');
  c.on('notification', m => {
    const d = `data: ${JSON.stringify({ valor: m.payload })}\n\n`;
    for (const r of clients) r.write(d);
  });
})();

https.createServer({
  key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem')
}, (req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write('\n'); clients.add(res);
    pool.query('SELECT valor FROM elementos ORDER BY id DESC LIMIT 1')
      .then(r => res.write(`data: ${JSON.stringify({ valor: r.rows[0] && r.rows[0].valor })}\n\n`))
      .catch(() => res.write(`data: ${JSON.stringify({ valor: null })}\n\n`));
    req.on('close', () => clients.delete(res)); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset=utf-8><title>SSE</title>
<body style="font-family:Arial;align-items:center;justify-content:center;">

    <div>ÚLTIMO VALOR:</div>
    <pre id=v>carregando...</pre>

    <script>
      const es = new EventSource('/events');
      es.onmessage = e => document.getElementById('v').textContent = JSON.parse(e.data).valor;
    </script>
</body>`);
}).listen(8443, ()=>console.log('https://localhost:8443'));
