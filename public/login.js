// login.js - verifica localStorage e redireciona se já estiver logado
document.title = 'Login';

(function(){
  try {
    const uid = localStorage.getItem('uid');
    const email = localStorage.getItem('email');
    if (uid && email) {
      // já logado -> ir direto pro painel
      location.href = '/panel';
    }
  } catch(e){}
})();
