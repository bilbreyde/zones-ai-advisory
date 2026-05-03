import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Assessment from './pages/Assessment.jsx'
import Results from './pages/Results.jsx'
import Clients from './pages/Clients.jsx'
import AgentStudio from './pages/AgentStudio.jsx'
import Help from './pages/Help.jsx'
import DataIntelligence from './pages/DataIntelligence.jsx'
import CloudModernization from './pages/CloudModernization.jsx'
import { ClientProvider } from './ClientContext.jsx'

export default function App() {
  return (
    <ClientProvider>
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="assessment/:pillar?" element={<Assessment />} />
        <Route path="results" element={<Results />} />
        <Route path="clients" element={<Clients />} />
        <Route path="agents" element={<AgentStudio />} />
        <Route path="help" element={<Help />} />
        <Route path="data-intelligence" element={<DataIntelligence />} />
        <Route path="cloud-modernization" element={<CloudModernization />} />
      </Route>
    </Routes>
    </ClientProvider>
  )
}
