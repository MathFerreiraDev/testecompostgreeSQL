// panel.js - usa localStorage (salvo no POST /login) e EventSource com reconexão
document.title = 'Painel';

(function(){
  const userEl = () => document.getElementById('user');
  const fields = {
    nivel: () => document.getElementById('nivel'),
    temperatura: () => document.getElementById('temperatura'),
    ph: () => document.getElementById('ph'),
    cloro: () => document.getElementById('cloro')
  };

  const uid = localStorage.getItem('uid');
  const userEmail = localStorage.getItem('email');

  if (!uid || !userEmail) { location.href = '/'; return; }
  userEl().textContent = userEmail;

  const setVal = (key, v) => {
    const el = fields[key]();
    if (!el) return;
    el.textContent = (v === null || v === undefined) ? '—' : v;
  };

  // SSE with simple reconnect
  let es = null;
  let reconnectTimer = null;
  const connect = () => {
    try {
      es = new EventSource('/events?uid=' + encodeURIComponent(uid));
      es.onopen = () => {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        console.log('SSE open');
      };
      es.onmessage = e => {
        try {
          const obj = JSON.parse(e.data);
          if (!obj) {
            setVal('nivel', null); setVal('temperatura', null); setVal('ph', null); setVal('cloro', null);
            return;
          }
          setVal('nivel', obj.nivel);
          setVal('temperatura', obj.temperatura);
          setVal('ph', obj.ph);
          setVal('cloro', obj.cloro);
        } catch (err) { console.error('SSE parse', err); }
      };
      es.onerror = () => {
        console.error('SSE error, will reconnect');
        try { es.close(); } catch {}
        if (!reconnectTimer) reconnectTimer = setTimeout(connect, 2000);
      };
    } catch (err) {
      console.error('SSE connect failed', err);
      if (!reconnectTimer) reconnectTimer = setTimeout(connect, 2000);
    }
  };
  connect();

  // logout
  const logoutBtn = document.getElementById('logout');
  logoutBtn.addEventListener('click', (e) => {
    try { localStorage.removeItem('uid'); localStorage.removeItem('email'); } catch {}
    // allow normal navigation to '/'
  });

  // cleanup
  window.addEventListener('beforeunload', () => { try { if (es) es.close(); } catch {} });
})();
