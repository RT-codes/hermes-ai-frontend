import { useChatSessions } from '../../context/ChatSessionsContext'
import { useRuntimeStatus } from '../../context/RuntimeStatusContext'

export function ActivityPanel() {
  const { sessions, openTabIds } = useChatSessions()
  const { hermesOnline, hindsightOnline } = useRuntimeStatus()
  const activeChat = sessions.find((session) => session.connectionState === 'connecting' || session.connectionState === 'streaming')
  const errorCount = sessions.filter((session) => session.connectionState === 'error').length

  return (
    <ul className="activity-status-list">
      <li><span className={`activity-dot ${hermesOnline ? 'active' : 'error'}`} /> Hermes API {hermesOnline ? 'ready' : 'offline'}</li>
      <li><span className={`activity-dot ${hindsightOnline ? 'active' : 'error'}`} /> Hindsight {hindsightOnline ? 'ready' : 'offline'}</li>
      <li><span className={`activity-dot ${activeChat ? 'busy' : ''}`} /> {activeChat ? `Hermes working · ${activeChat.title}` : `${openTabIds.length} chat tab${openTabIds.length === 1 ? '' : 's'} open`}</li>
      <li><span className={`activity-dot ${errorCount > 0 ? 'error' : ''}`} /> {errorCount > 0 ? `${errorCount} chat error${errorCount === 1 ? '' : 's'}` : `${sessions.length} saved conversation${sessions.length === 1 ? '' : 's'}`}</li>
    </ul>
  )
}
