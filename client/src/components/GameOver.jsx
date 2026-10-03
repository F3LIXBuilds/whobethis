import Card from './Card.jsx';
import FriendButton from './FriendButton.jsx';
import { celebName, formatDuration } from '../utils.js';

function headline(result, me, oppName) {
  const won = result.winner === me;
  if (result.reason === 'snipe_hit') return won ? 'YOU SNIPED IT!' : `${oppName} sniped your celebrity.`;
  if (result.reason === 'snipe_miss') {
    return won ? `${oppName} missed their last snipe.` : 'You missed your last snipe.';
  }
  if (result.reason === 'disconnect') {
    return won ? `${oppName} disconnected and didn’t come back.` : 'You were disconnected for too long.';
  }
  return won ? `${oppName} left the game.` : 'You left the game.';
}

export default function GameOver({ state, celebs, friends, onRequestFriend, onAcceptFriend, onLeave }) {
  const { you: me, result, players } = state;
  const opp = 1 - me;
  const find = (id) => celebs.find((c) => c.id === id);
  const mine = find(result.secrets[me]);
  const theirs = find(result.secrets[opp]);

  return (
    <section className="result">
      <h2>{result.winner === me ? '🏆 YOU WIN' : '❌ YOU LOSE'}</h2>
      <p>{headline(result, me, players[opp].name)}</p>

      <div className="reveal">
        <div>
          <small>YOUR CELEBRITY</small>
          {mine && <Card celeb={mine} />}
        </div>
        <div>
          <small>{players[opp].name.toUpperCase()}’S CELEBRITY</small>
          {theirs && <Card celeb={theirs} />}
        </div>
      </div>

      <ul>
        {result.guessedId && <li>The final snipe was: <b>{celebName(celebs, result.guessedId)}</b></li>}
        <li>Questions asked: <b>{result.questionCount}</b></li>
        <li>Time played: <b>{formatDuration(result.durationMs)}</b></li>
      </ul>

      <div className="center">
        <FriendButton
          name={players[opp].name}
          friends={friends}
          onRequest={onRequestFriend}
          onAccept={onAcceptFriend}
        />
      </div>
      <button className="btn primary" onClick={onLeave}>BACK TO LOBBY</button>
    </section>
  );
}