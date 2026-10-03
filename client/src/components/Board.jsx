import Card from './Card.jsx';
import DensityToggle from './DensityToggle.jsx';
import { haptic, useDensity } from '../hooks/useMobile.js';

// eliminated = flipped-down cards. dimmedIds = greyed but still upright (used by the snipe picker).
export default function Board({ celebs, eliminated = [], dimmedIds = [], onToggle, selectedId, mineId }) {
  const density = useDensity();
  const down = new Set(eliminated);
  const dim = new Set(dimmedIds);

  return (
    <>
      <DensityToggle />
      <div className={`board d-${density}`}>
        {celebs.map((c) => (
          <Card
            key={c.id}
            celeb={c}
            down={down.has(c.id)}
            dim={dim.has(c.id)}
            selected={selectedId === c.id}
            mine={mineId === c.id}
            onClick={
              onToggle
                ? () => {
                    haptic(10);
                    onToggle(c.id);
                  }
                : undefined
            }
          />
        ))}
      </div>
    </>
  );
}