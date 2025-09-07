import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [email,setEmail] = useState('')
  const [senha,setSenha] = useState('')
  const [err,setErr] = useState('')
  const nav = useNavigate()

  async function submit(e){
    e.preventDefault()
    setErr('')
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    })
    const j = await r.json()
    if(!j.ok){ setErr('Credenciais inválidas'); return }
    // salvar no sessionStorage para o painel
    sessionStorage.setItem('uid', String(j.uid))
    sessionStorage.setItem('email', j.email)
    // opcional: guardar último registro
    sessionStorage.setItem('last', JSON.stringify(j.last || null))
    nav('/panel')
  }

  return (
    <div style={{fontFamily:'Arial',display:'flex',height:'100vh',alignItems:'center',justifyContent:'center'}}>
      <form onSubmit={submit} style={{width:300}}>
        <h3>Login</h3>
        <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} required style={{width:'100%'}}/>
        <br/><br/>
        <input placeholder="senha" type="password" value={senha} onChange={e=>setSenha(e.target.value)} required style={{width:'100%'}}/>
        <br/><br/>
        <button style={{width:'100%'}}>Entrar</button>
        {err && <p style={{color:'red'}}>{err}</p>}
      </form>
    </div>
  )
}
