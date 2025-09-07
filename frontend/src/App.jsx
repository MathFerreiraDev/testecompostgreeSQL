import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './Login'
import Panel from './Panel'

export default function App(){ 
  return (
    <Routes>
      <Route path="/" element={<Login/>}/>
      <Route path="/panel" element={<Panel/>}/>
    </Routes>
  )
}
