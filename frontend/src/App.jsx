import { Routes, Route, Navigate } from ''react-router-dom''
import Layout from ''./components/Layout.jsx''
import Dashboard from ''./pages/Dashboard.jsx''
import Assessment from ''./pages/Assessment.jsx''
import Results from ''./pages/Results.jsx''
import Clients from ''./pages/Clients.jsx''

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="assessment/:pillar?" element={<Assessment />} />
        <Route path="results" element={<Results />} />
        <Route path="clients" element={<Clients />} />
      </Route>
    </Routes>
  )
}

