export default function WaitingRoom({ state, friends, onInvite, onLeave }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(state.code); } catch { /* not available on http LAN */ }
  };
  const onlineFriends = friends.friends.filter((f) => f.status === 'online');

  return (
    <main className="screen lobby">
      <div className="logo-wrap">
        <div className="ankara" />
        <h1 className="logo">WHO BE THIS?</h1>
        <div className="ankara" />
      </div>
      <div className="panel center">
        <p className="muted">Share this room code</p>
        <div className="code">{state.code}</div>
        <button className="btn ghost" onClick={copy}>COPY CODE</button>
        <p className="waiting">Waiting for opponent…</p>

        {onlineFriends.length > 0 && (
          <div className="invite-list">
            <p className="muted small-note">Invite a friend who’s online</p>
            {onlineFriends.map((f) => (
              <div key={f.username} className="friend-row">
                <span>🟢 <b>{f.username}</b></span>
                <button className="btn primary small" onClick={() => onInvite(f.username)}>INVITE</button>
              </div>
            ))}
          </div>
        )}

        <button className="btn ghost" onClick={onLeave}>CANCEL</button>
      </div>
    </main>
  );
}