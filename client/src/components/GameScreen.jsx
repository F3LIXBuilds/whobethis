import { useState } from 'react';
import Board from './Board.jsx';
import SnipeModal from './SnipeModal.jsx';
import GameOver from './GameOver.jsx';
import History from './History.jsx';
import OpponentBanner from './OpponentBanner.jsx';
import FriendButton from './FriendButton.jsx';
import { celebName } from '../utils.js';
import { useOptimisticBoard } from '../hooks/useOptimisticBoard.js';
import { useLatency } from '../hooks/useMobile.js';

export default function GameScreen({ state, celebs, emit, friends, onRequestFriend, onAcceptFriend, onLeave }) {
  const [text, setText] = useState('');
  const [eliminated, toggleCard] = useOptimisticBoard(state.myEliminated, emit);
  const ping = useLatency(true);
  const { you: me, phase, activePlayer, players, question, result, lastSnipe } = state;
  const myTurn = activePlayer === me;
  const canEliminate = phase === 'ELIMINATING' && myTurn;
  const over = phase === 'GAME_OVER' && result;
  const turnName = `${players[activePlayer].name.toUpperCase()}'S TURN`;

  const submitQuestion = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await emit('question:ask', { text });
    if (r.ok) setText('');
  };

  const leave = () => {
    if (phase === 'GAME_OVER' || window.confirm('Leave the game? You will forfeit and take a loss.')) onLeave();
  };

  const snipeBtn = (
    <button type="button" className="btn snipe" onClick={() => emit('snipe:start')}>
      🎯 SNIPE · {players[me].snipesLeft}
    </button>
  );

  // ---- status line ----
  let status = null;
  if (phase === 'ASKING') {
    status = [turnName, myTurn ? 'Ask your question.' : 'Waiting for their question…'];
  } else if (phase === 'WAITING_FOR_ANSWER') {
    status = [turnName, myTurn ? 'Waiting for your opponent to answer…' : 'Answer the question below.'];
  } else if (phase === 'ELIMINATING') {
    status = myTurn
      ? [turnName, `They said ${question?.answer}. Put down celebrities, then end your turn.`]
      : [turnName, 'Your opponent is eliminating…'];
  }

  // ---- action bar ----
  let dock = null;
  if (phase === 'ASKING' && myTurn) {
    dock = (
      <form className="ask-form" onSubmit={submitQuestion}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Is your celebrity a musician?"
          maxLength={200}
          autoComplete="off"
        />
        <button className="btn primary" type="submit" disabled={!text.trim()}>ASK</button>
        {snipeBtn}
      </form>
    );
  } else if (phase === 'WAITING_FOR_ANSWER' && !myTurn) {
    dock = (
      <div className="answer-box">
        <div className="qbox">
          {players[activePlayer].name} asked: “{question?.text}”
        </div>
        <div className="answer-btns">
          <button className="btn yes" onClick={() => emit('question:answer', { answer: 'YES' })}>YES</button>
          <button className="btn no" onClick={() => emit('question:answer', { answer: 'NO' })}>NO</button>
        </div>
      </div>
    );
  } else if (phase === 'ELIMINATING' && myTurn) {
    dock = (
      <div className="elim-bar">
        <span className="muted">Tap a card to put it down. Tap again to bring it back.</span>
        <div className="elim-actions">
          {snipeBtn}
          <button className="btn primary" onClick={() => emit('turn:end')}>END TURN</button>
        </div>
      </div>
    );
  }

  return (
    <main className="screen">
      <header className="top">
        <h1 className="logo small">WHO BE THIS?</h1>
        <span className="muted small-note">Today’s board · {state.boardDate}</span>
        <span className={`ping ${ping == null ? 'bad' : ping < 150 ? 'good' : ping < 400 ? 'ok' : 'bad'}`}>
          📶 {ping == null ? '…' : `${ping}ms`}
        </span>
        <button className="btn ghost small" onClick={leave}>LEAVE</button>
      </header>

      <section className="game-head">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`side ${i === me ? 'you' : ''} ${i === activePlayer && phase !== 'GAME_OVER' ? 'active' : ''}`}
          >
            <b>{players[i].name}</b>
            <small>{i === me ? 'Your Board' : 'Opponent'} · 🎯 {players[i].snipesLeft}</small>
            {!players[i].connected && <em>offline</em>}
            {i !== me && !over && (
              <FriendButton
                name={players[i].name}
                friends={friends}
                onRequest={onRequestFriend}
                onAccept={onAcceptFriend}
              />
            )}
          </div>
        ))}
      </section>

      <OpponentBanner state={state} />

      {lastSnipe && phase === 'ASKING' && (
        <div className="banner warn inline">
          {players[lastSnipe.by].name} sniped {celebName(celebs, lastSnipe.guessedId)} and missed (
          {lastSnipe.snipesLeft} snipe{lastSnipe.snipesLeft === 1 ? '' : 's'} left). Turn passes.
        </div>
      )}

      {over ? (
        <GameOver
          state={state}
          celebs={celebs}
          friends={friends}
          onRequestFriend={onRequestFriend}
          onAcceptFriend={onAcceptFriend}
          onLeave={onLeave}
        />
      ) : (
        status && (
          <section className={`turnbar ${myTurn ? 'mine' : ''}`}>
            <b>{status[0]}</b>
            <span>{status[1]}</span>
          </section>
        )
      )}

      <History history={state.history} me={me} players={players} />

      <Board
        celebs={celebs}
        eliminated={[...eliminated]}
        mineId={state.mySecret}
        onToggle={canEliminate ? toggleCard : undefined}
      />

      {phase === 'SNIPE_CONFIRMATION' &&
        (myTurn ? (
          <SnipeModal
            celebs={celebs}
            eliminated={[...eliminated]}
            missed={state.myMissedSnipes}
            snipesLeft={players[me].snipesLeft}
            emit={emit}
          />
        ) : (
          <div className="modal-back">
            <div className="modal">
              <h2>🎯 SNIPE INCOMING</h2>
              <p className="muted">{players[activePlayer].name} is going for a snipe…</p>
            </div>
          </div>
        ))}

      {dock && (
        <div className="dock">
          <div className="dock-inner">{dock}</div>
        </div>
      )}
    </main>
  );
}