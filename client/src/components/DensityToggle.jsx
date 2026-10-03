import { setDensity, useDensity } from '../hooks/useMobile.js';

const OPTIONS = [['s', 'S'], ['m', 'M'], ['l', 'L']];

export default function DensityToggle() {
  const density = useDensity();
  return (
    <div className="density" role="group" aria-label="Card size">
      <span>Card size</span>
      {OPTIONS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={density === key ? 'on' : ''}
          aria-pressed={density === key}
          onClick={() => setDensity(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}