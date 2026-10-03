import { useState } from 'react';
import Board from './Board.jsx';
import { celebName } from '../utils.js';

export default function SnipeModal({ celebs, eliminated, missed, snipesLeft, emit }) {
  const [step, setStep] = useState('confirm');
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);

  const cancel = () => emit('snipe:cancel');

  const fire = async () => {
    if (!pick || busy) return;
    setBusy(true);
    const r = await emit('snipe:guess', { id: pick });
    if (!r.ok) setBusy(false);
  };

  if (step === 'confirm') {
    return (
      <div className="modal-back">
        <div className="modal">
          <h2>🎯 SNIPE</h2>
          <p>Are you sure you know their celebrity?</p>
          <p className="muted">
            {snipesLeft > 1
              ? `You have ${snipesLeft} snipes. A miss costs you your turn.`
              : 'This is your LAST snipe. Miss and you lose the game.'}
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={cancel}>NOT YET</button>
            <button className="btn snipe" onClick={() => setStep('pick')}>I KNOW WHO IT IS</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-back">
      <div className="modal wide">
        <h2>WHO IS IT?</h2>
        <p className="muted">
          {pick ? `Your snipe: ${celebName(celebs, pick)}` : 'Tap the celebrity you think they picked.'}
        </p>
        <div className="modal-board">
          <Board
            celebs={celebs}
            dimmedIds={[...eliminated, ...missed]}
            selectedId={pick}
            onToggle={(id) => { if (!missed.includes(id)) setPick(id); }}
          />
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={cancel}>CANCEL</button>
          <button className="btn snipe" disabled={!pick || busy} onClick={fire}>
            🎯 FIRE{pick ? `: ${celebName(celebs, pick)}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}