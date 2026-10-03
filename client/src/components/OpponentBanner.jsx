import { useCountdown } from '../hooks/useCountdown.js';

export default function OpponentBanner({ state }) {
  const opp = state.players[1 - state.you];
  const secs = useCountdown(opp?.reconnectDeadline, state.serverTime);

  if (!opp || opp.connected || state.phase === 'GAME_OVER') return null;

  return (
    <div className="banner warn inline">
      Your opponent disconnected.{' '}
      {opp.reconnectDeadline
        ? `Waiting for them to come back… ${secs}s`
        : 'Waiting for them to come back…'}
    </div>
  );
}