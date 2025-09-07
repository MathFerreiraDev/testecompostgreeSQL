// login.js - apenas título e pequeno comportamento (não obrigatório)
document.title = 'Login';

// se quiser auto-redirecionar quando já está logado (mantém "lembrar login")
(function(){
  try {
    const uid = sessionStorage.getItem('uid');
    const email = sessionStorage.getItem('email');
    if (uid && email) {
      // já logado -> ir direto pro painel
      location.href = '/panel';
    }
  } catch(e){}
})();
