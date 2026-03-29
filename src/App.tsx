import { useEffect } from 'react'
import { Desktop } from './os/Desktop'
import { useOsStore } from './os/useOsStore'

function App() {
  const bootstrap = useOsStore((state) => state.bootstrap)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  return <Desktop />
}

export default App
