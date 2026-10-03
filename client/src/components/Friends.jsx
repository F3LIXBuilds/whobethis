import { useState } from 'react';

const ORDER = { online: 0, 'in-game': 1, offline: 2 };
const DOT = { online: '🟢', 'in-game': '🟡', offline: '⚫' };
const LABEL = { online: 'online', 'in-game': 'in a game', offline: 'offline' };

export default function Friends({ friends, onRequest, onRespond, onRemove, onPlay }) {
  const [name, setName] = useState('');

  const add = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const r = await onRequest(n);
    if (r?.ok) setName('');
  };

  const sorted = [...friends.friends].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.username.localeCompare(b.username)
  );

  return (
    <>
      <form className="panel" onSubmit={add}>
        <h3>ADD A FRIEND</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))}
          placeholder="Their username"
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn" type="submit" disabled={!name.trim()}>SEND REQUEST</button>
        {friends.outgoing.length > 0 && (
          <p className="muted small-note">Waiting on: {friends.outgoing.join(', ')}</p>
        )}
      </form>

      {friends.incoming.length > 0 && (
        <div className="panel">
          <h3>FRIEND REQUESTS</h3>
          {friends.incoming.map((u) => (
            <div key={u} className="friend-row">
              <b>{u}</b>
              <span className="row-actions">
                <button className="btn primary small" onClick={() => onRespond(u, true)}>ACCEPT</button>
                <button className="btn ghost small" onClick={() => onRespond(u, false)}>DECLINE</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>YOUR FRIENDS ({sorted.length})</h3>
        {sorted.length === 0 ? (
          <p className="muted center">No friends yet. Add someone after a game, or by username.</p>
        ) : (
          sorted.map((f) => (
            <div key={f.username} className="friend-row">
              <span>
                {DOT[f.status]} <b>{f.username}</b> <small className="muted">{LABEL[f.status]}</small>
              </span>
              <span className="row-actions">
                <button
                  className="btn primary small"
                  disabled={f.status !== 'online'}
                  onClick={() => onPlay(f.username)}
                >
                  PLAY
                </button>
                <button
                  className="btn ghost small"
                  aria-label={`Remove ${f.username}`}
                  onClick={() => window.confirm(`Remove ${f.username} from your friends?`) && onRemove(f.username)}
                >
                  ✕
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}