// panel.js - usa localStorage (salvo no POST /login) e EventSource
document.title = 'Painel';

(function(){
  try {
    const uid = localStorage.getItem('uid');
    const userEmail = localStorage.getItem('email');
    if (!uid || !userEmail) {
      location.href = '/';
      return;
    }

    document.getElementById('user').textContent = 'Bem-vindo — ' + userEmail;

    const setField = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'ph') el.textContent = 'pH: ' + (v === null ? '—' : v);
      else if (id === 'nivel') el.textContent = 'Nível: ' + (v === null ? '—' : v);
      else if (id === 'temperatura') el.textContent = 'Temperatura: ' + (v === null ? '—' : v);
      else el.textContent = 'Cloro: ' + (v === null ? '—' : v);
    };

    const es = new EventSource('/events?uid=' + encodeURIComponent(uid));
    es.onmessage = e => {
      try {
        const obj = JSON.parse(e.data);
        if (!obj) { setField('nivel', null); setField('temperatura', null); setField('ph', null); setField('cloro', null); return; }
        setField('nivel', obj.nivel);
        setField('temperatura', obj.temperatura);
        setField('ph', obj.ph);
        setField('cloro', obj.cloro);
      } catch (err) { console.error('SSE parse', err); }
    };
    es.onerror = err => {
      console.error('EventSource erro', err);
    };

    document.getElementById('logout').addEventListener('click', function(e){
      // limpar armazenamento local e permitir navegação para login
      localStorage.clear();
      // navigation will proceed because <a href="/"> is used
    });

    window.addEventListener('beforeunload', ()=> { try{ es.close() }catch{} });
  } catch(e){ console.error(e) }
})();
