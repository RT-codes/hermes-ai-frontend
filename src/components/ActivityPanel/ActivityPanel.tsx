export function ActivityPanel() {
  return (
    <section className="panel activity-panel">
      <span className="panel-label">ACTIVITY</span>

      <ul>
        <li><span className="activity-dot active" /> Hermes ready</li>
        <li><span className="activity-dot" /> Memory idle</li>
        <li><span className="activity-dot" /> Tools idle</li>
      </ul>
    </section>
  )
}
