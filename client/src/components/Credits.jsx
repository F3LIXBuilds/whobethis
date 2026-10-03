export default function Credits({ celebs, onClose }) {
  const credited = celebs.filter((c) => c.credit);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>PHOTO CREDITS</h2>
        <p className="muted small-note">
          Photos are from Wikimedia Commons under free licenses. WHO BE THIS? is a fan-made game and is not
          affiliated with or endorsed by anyone shown.
        </p>
        <div className="modal-board">
          {credited.length === 0 ? (
            <p className="muted">No photos yet.</p>
          ) : (
            <ul className="credits">
              {credited.map((c) => (
                <li key={c.id}>
                  <b>{c.name}</b>: {c.credit.author},{' '}
                  <a href={c.credit.source} target="_blank" rel="noreferrer">{c.credit.license}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}