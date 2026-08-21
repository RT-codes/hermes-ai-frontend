import { useEffect, useMemo, useState } from 'react'
import { NEW_CHAT_PROFILE_REQUEST_EVENT, useChatSessions } from '../../../context/ChatSessionsContext'
import { useHermesProfiles } from '../../../context/HermesProfileContext'
import { DEFAULT_HERMES_PROFILE_ID } from '../../../lib/hermes/profiles'

const LAST_PROFILE_STORAGE_KEY = 'hermes-new-chat-profile:v1'

function storedProfileId() {
  try {
    return window.localStorage.getItem(LAST_PROFILE_STORAGE_KEY) || DEFAULT_HERMES_PROFILE_ID
  } catch {
    return DEFAULT_HERMES_PROFILE_ID
  }
}

export function NewChatProfileDialog() {
  const { createSession } = useChatSessions()
  const { profiles, status, warning, getProfileColor } = useHermesProfiles()
  const [open, setOpen] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState(storedProfileId)

  const availableProfiles = useMemo(() => profiles.filter((profile) => profile.available), [profiles])

  useEffect(() => {
    const openDialog = () => setOpen(true)
    window.addEventListener(NEW_CHAT_PROFILE_REQUEST_EVENT, openDialog)
    return () => window.removeEventListener(NEW_CHAT_PROFILE_REQUEST_EVENT, openDialog)
  }, [])

  useEffect(() => {
    if (!open) return
    const selectedStillAvailable = availableProfiles.some((profile) => profile.id === selectedProfileId)
    if (selectedStillAvailable) return
    const defaultProfile = availableProfiles.find((profile) => profile.isDefault)
    setSelectedProfileId(defaultProfile?.id ?? availableProfiles[0]?.id ?? DEFAULT_HERMES_PROFILE_ID)
  }, [availableProfiles, open, selectedProfileId])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open) return null

  const selected = profiles.find((profile) => profile.id === selectedProfileId)
  const canCreate = Boolean(selected?.available)

  const handleCreate = () => {
    if (!selected?.available) return
    try {
      window.localStorage.setItem(LAST_PROFILE_STORAGE_KEY, selected.id)
    } catch {
      // Persistence is a convenience; chat creation should still work without it.
    }
    createSession(selected.id)
    setOpen(false)
  }

  return (
    <div className="new-chat-profile-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false)
    }}>
      <section className="new-chat-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="new-chat-profile-title">
        <div className="new-chat-profile-dialog__header">
          <div>
            <span>New Hermes conversation</span>
            <h2 id="new-chat-profile-title">Choose profile</h2>
            <p>This profile is permanently bound to the new chat. Switching agents later means opening another conversation.</p>
          </div>
          <button type="button" className="new-chat-profile-dialog__close" aria-label="Close profile picker" onClick={() => setOpen(false)}>×</button>
        </div>

        {status === 'degraded' && (
          <div className="new-chat-profile-dialog__warning">
            <strong>PROFILE DISCOVERY DEGRADED</strong>
            <span>{warning ?? 'Only profiles currently known to the registry can be selected.'}</span>
          </div>
        )}

        <div className="new-chat-profile-list" role="radiogroup" aria-label="Hermes profile">
          {profiles.map((profile) => {
            const color = getProfileColor(profile.id)
            const active = selectedProfileId === profile.id
            return (
              <button
                key={profile.id}
                type="button"
                className={`new-chat-profile-option ${active ? 'is-selected' : ''}`}
                style={{ '--profile-color': color } as React.CSSProperties}
                role="radio"
                aria-checked={active}
                disabled={!profile.available}
                onClick={() => setSelectedProfileId(profile.id)}
              >
                <span className="new-chat-profile-option__signal" aria-hidden="true" />
                <span className="new-chat-profile-option__copy">
                  <strong>{profile.displayName}</strong>
                  <code>{profile.id}</code>
                </span>
                <span className="new-chat-profile-option__state">
                  {profile.isDefault && <small>DEFAULT</small>}
                  <small>{profile.available ? 'AVAILABLE' : 'UNAVAILABLE'}</small>
                </span>
              </button>
            )
          })}
        </div>

        <div className="new-chat-profile-dialog__footer">
          <span>{status === 'loading' ? 'Profile registry is refreshing…' : `${availableProfiles.length} selectable profile${availableProfiles.length === 1 ? '' : 's'}`}</span>
          <div>
            <button type="button" className="workspace-action workspace-action--quiet" onClick={() => setOpen(false)}>CANCEL</button>
            <button type="button" className="workspace-action" disabled={!canCreate} onClick={handleCreate}>START CHAT</button>
          </div>
        </div>
      </section>
    </div>
  )
}
