function App() {
  return (
    <main className="hermes-home">
      <header className="topbar">
        <div>
          <div className="eyebrow">HERMES HOME</div>
          <h1>Control Center</h1>
        </div>

        <div className="status-pill">
          <span className="status-dot" />
          System Online
        </div>
      </header>

      <section className="panel chat-panel">
        <span className="panel-label">CHAT</span>
        <p>Hermes is ready.</p>
      </section>

      <section className="brain-stage">
        <div className="brain-placeholder">
          <div className="brain-core">H</div>
          <span>Brain visualization</span>
        </div>
      </section>

      <section className="panel activity-panel">
        <span className="panel-label">ACTIVITY</span>

        <ul>
          <li><span className="activity-dot active" /> Hermes ready</li>
          <li><span className="activity-dot" /> Memory idle</li>
          <li><span className="activity-dot" /> Tools idle</li>
        </ul>
      </section>

      <section className="panel system-panel">
        <span className="panel-label">SYSTEM</span>
        <p>Qwen</p>
        <p>Hindsight</p>
        <p>Ollama</p>
      </section>
    </main>
  )
}

export default App