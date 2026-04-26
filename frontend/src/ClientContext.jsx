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

  return (
    <ClientContext.Provider value={{ client, setClient }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClient() {
  return useContext(ClientContext)
}
