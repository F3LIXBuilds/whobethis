import { useCallback, useEffect, useState } from 'react';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ me }) {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="panel wide">
      <h3>TOP PLAYERS <button className="btn ghost small" onClick={load}>REFRESH</button></h3>
      {failed && <p className="muted center">Could not load the leaderboard.</p>}
      {!failed && rows === null && <p className="muted center">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted center">No ranked games yet. Be the first!</p>}
      {rows && rows.length > 0 && (
        <div className="table-wrap">
          <table className="lb">
            <thead>
              <tr><th>#</th><th>Player</th><th>Games</th><th>Wins</th><th>🎯 Snipes</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.username} className={r.username === me ? 'me' : ''}>
                  <td>{MEDAL[r.rank] ?? r.rank}</td>
                  <td>{r.username}</td>
                  <td>{r.games}</td>
                  <td>{r.confirmedWins}</td>
                  <td>{r.confirmedSnipes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small-note center">
        Wins and snipes are server-verified. Quitting a game counts as a loss.
      </p>
    </div>
  );
}