// app.js - SSE + LISTEN/NOTIFY pronto para deploy
const { Pool } = require('pg');
const http = require('http');
const url = require('url');

const DB = process.env.DATABASE_URL || 'postgresql://postgres:vfqipiyXckgfwRowbRHiuNJkhETzPnTE@gondola.proxy.rlwy.net:37016/railway';
const pool = new Pool({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const clients = new Set();

// Listener PostgreSQL
(async () => {
  const c = await pool.connect();
  await c.query('LISTEN novodado');
  c.on('notification', m => {
    const d = `data: ${JSON.stringify({ valor: m.payload })}\n\n`;
    for (const r of clients) r.write(d);
  });
})();

// Servidor HTTP (Railway adiciona HTTPS automaticamente)
const server = http.createServer(async (req, res) => {
  const p = url.parse(req.url).pathname;

  if (p === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    clients.add(res);

    try {
      const { rows } = await pool.query('SELECT valor FROM elementos ORDER BY id DESC LIMIT 1');
      res.write(`data: ${JSON.stringify({ valor: rows[0] && rows[0].valor })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ valor: null })}\n\n`);
    }

    req.on('close', () => clients.delete(res));
    return;
  }

  // Página HTML
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
});

// Porta do Railway
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Rodando em porta ${PORT}`));
