import { useState } from 'react';
import Board from './Board.jsx';
import OpponentBanner from './OpponentBanner.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { celebName } from '../utils.js';

export default function SelectionScreen({ state, celebs, emit }) {
  const [pick, setPick] = useState(null);
  const secs = useCountdown(state.selectionDeadline, state.serverTime);
  const locked = state.mySecret;
  const oppLocked = state.players[1 - state.you]?.locked;
  const oppOnline = state.players[1 - state.you]?.connected;

  let hint = 'Tap a card, then lock it in. Your opponent can’t see your pick.';
  if (locked) {
    hint = `You locked in ${celebName(celebs, locked)}. ${
      oppLocked ? 'Starting…' : 'Waiting for your opponent…'
    }`;
  } else if (pick) {
    hint = `Selected: ${celebName(celebs, pick)}`;
  }

  return (
    <main className="screen">
      <header className="top">
        <h1 className="logo small">WHO BE THIS?</h1>
        {oppOnline && <span className="chip good">OPPONENT CONNECTED</span>}
      </header>

      <OpponentBanner state={state} />

      <section className="select-head">
        <h2>{locked ? 'CELEBRITY LOCKED!' : 'CHOOSE YOUR CELEBRITY'}</h2>
        <div className={`timer ${secs <= 10 ? 'urgent' : ''}`}>{secs}</div>
        <p className="muted">{hint}</p>
        {!locked && (
          <button
            className="btn primary"
            disabled={!pick}
            onClick={() => emit('select:celebrity', { id: pick })}
          >
            LOCK IT IN
          </button>
        )}
      </section>

      <Board
        celebs={celebs}
        selectedId={pick}
        mineId={locked}
        onToggle={locked ? undefined : (id) => setPick(id)}
      />
    </main>
  );
}