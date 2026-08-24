import { AppProviders } from './app/providers/AppProviders'
import { HermesHome } from './app/shell/HermesHome'
import './styles/app.css'

/** Root composition intentionally contains no workspace or feature-specific policy. */
function App() {
  return (
    <AppProviders>
      <HermesHome />
    </AppProviders>
  )
}

export default App
