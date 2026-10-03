import { useState } from 'react';
import { hueFor, initials } from '../utils.js';

export default function Card({ celeb, down, dim, selected, mine, onClick }) {
  const [broken, setBroken] = useState(false);
  const photo = celeb.image && !broken;
  const h = hueFor(celeb.id);

  const cls = [
    'card',
    onClick && 'interactive',
    down && 'down',
    dim && 'dim',
    selected && 'selected',
    mine && 'mine',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-pressed={down}
      aria-label={`${celeb.name}${down ? ' (down)' : ''}`}
    >
      <div className="card-inner">
        {mine && <span className="badge">YOUR PICK</span>}
        <div
          className="avatar"
          style={
            photo
              ? undefined
              : { background: `linear-gradient(135deg, hsl(${h} 55% 38%), hsl(${(h + 45) % 360} 60% 22%))` }
          }
        >
          {photo ? (
            <img src={celeb.image} alt="" loading="lazy" draggable="false" onError={() => setBroken(true)} />
          ) : (
            initials(celeb.name)
          )}
        </div>
        <div className="name">{celeb.name}</div>
        <div className="tag">{celeb.profession}</div>
      </div>
    </button>
  );
}