import { createContext, useContext, useState } from 'react'

const ClientContext = createContext(null)

export function ClientProvider({ children }) {
  const [client, setClientState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zaic_client')) } catch { return null }
  })

  function setClient(c) {
    setClientState(c)
    if (c) localStorage.setItem('zaic_client', JSON.stringify(c))
    else localStorage.removeItem('zaic_client')
  }

  async function refreshClient(clientId) {
    const id = clientId || client?.id
    if (!id) return
    try {
      const apiBase = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiBase}/api/clients/${id}`)
      if (res.ok) {
        const updated = await res.json()
        setClient(updated)
      }
    } catch (err) {
      console.error('Failed to refresh client:', err)
    }
  }

  return (
    <ClientContext.Provider value={{ client, setClient, refreshClient }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  return useContext(ClientContext)
}
