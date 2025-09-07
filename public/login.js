// login.js - envia via fetch, mostra erro abaixo do formulário
document.title = 'Login';

(function(){
  try {
    const uid = localStorage.getItem('uid');
    const email = localStorage.getItem('email');
    if (uid && email) { location.href = '/panel'; return; }
  } catch(e){}

  const form = document.getElementById('loginForm');
  const errEl = document.getElementById('err');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errEl.textContent = '';
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    try {
      const r = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const j = await r.json();
      if (!j.ok) {
        if (j.error === 'invalid') errEl.textContent = 'Credenciais inválidas.';
        else if (j.error === 'missing') errEl.textContent = 'Preencha email e senha.';
        else errEl.textContent = 'Erro no servidor.';
        return;
      }
      localStorage.setItem('uid', String(j.uid));
      localStorage.setItem('email', j.email);
      // opcional: armazenar último registro se desejar
      location.href = '/panel';
    } catch (e) {
      console.error(e);
      errEl.textContent = 'Erro de rede.';
    }
  });
})();
