import { ActivityPanel } from './components/ActivityPanel/ActivityPanel'
import { BrainStage } from './components/BrainStage/BrainStage'
import { ChatPanel } from './components/ChatPanel/ChatPanel'
import { SystemPanel } from './components/SystemPanel/SystemPanel'
import { TopBar } from './components/TopBar/TopBar'
import { HouseholdProvider } from './context/HouseholdContext'
import './styles/layout.css'

function App() {
  return (
    <HouseholdProvider>
      <main className="hermes-home">
        <TopBar />
        <ChatPanel />
        <BrainStage />
        <ActivityPanel />
        <SystemPanel />
      </main>
    </HouseholdProvider>
  )
}

export default App
