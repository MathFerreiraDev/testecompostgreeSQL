import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Panel(){
  const nav = useNavigate()
  const uid = sessionStorage.getItem('uid')
  const email = sessionStorage.getItem('email')
  const lastStored = JSON.parse(sessionStorage.getItem('last') || 'null')

  const [nivel,setNivel] = useState(lastStored ? lastStored.nivel : null)
  const [temperatura,setTemperatura] = useState(lastStored ? lastStored.temperatura : null)
  const [ph,setPh] = useState(lastStored ? lastStored.ph : null)
  const [cloro,setCloro] = useState(lastStored ? lastStored.cloro : null)

  useEffect(()=>{
    if(!uid){ nav('/') ; return }
    const es = new EventSource('/events?uid='+uid)
    es.onmessage = e => {
      try {
        const obj = JSON.parse(e.data)
        if(!obj){ setNivel(null); setTemperatura(null); setPh(null); setCloro(null); return }
        setNivel(obj.nivel); setTemperatura(obj.temperatura); setPh(obj.ph); setCloro(obj.cloro)
      } catch(err){ console.error(err) }
    }
    es.onerror = err => console.error('SSE error', err)
    return ()=> es.close()
  }, [uid])

  return (
    <div style={{fontFamily:'Arial',padding:20,maxWidth:720,margin:'auto'}}>
      <h2>Bem-vindo — {email}</h2>
      <div style={{background:'#f7f7f7',padding:12,borderRadius:6}}>
        <div>ÚLTIMO REGISTRO:</div>
        <h3 id="nivel">Nível: {nivel === null ? '—' : nivel}</h3>
        <h3 id="temperatura">Temperatura: {temperatura === null ? '—' : temperatura}</h3>
        <h3 id="ph">pH: {ph === null ? '—' : ph}</h3>
        <h3 id="cloro">Cloro: {cloro === null ? '—' : cloro}</h3>
      </div>
      <p><a href="/" onClick={()=>{ sessionStorage.clear() }}>Sair</a></p>
    </div>
  )
}
