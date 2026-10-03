import { useMemo } from 'react';
import { useGame } from './hooks/useGame.js';
import { useReconnectOnResume, useTurnAlert, useWakeLock } from './hooks/useMobile.js';
import AuthScreen from './components/AuthScreen.jsx';
import Lobby from './components/Lobby.jsx';
import WaitingRoom from './components/WaitingRoom.jsx';
import SelectionScreen from './components/SelectionScreen.jsx';
import GameScreen from './components/GameScreen.jsx';

const Loading = ({ text }) => (
  <main className="screen"><p className="muted center">{text}</p></main>
);

export default function App() {
  const g = useGame();
  const { state, celebs } = g;

  useReconnectOnResume();
  useTurnAlert(state);
  useWakeLock(!!state && state.phase !== 'GAME_OVER');

  // The game's board = today's subset of the pool, in the server's (category-mixed) order
  const boardCelebs = useMemo(() => {
    if (!state?.board) return [];
    const byId = new Map(celebs.map((c) => [c.id, c]));
    return state.board.map((id) => byId.get(id)).filter(Boolean);
  }, [state?.board, celebs]);

  const acceptFriend = (username) => g.emit('friends:respond', { username, accept: true });

  let screen;
  if (!state) {
    if (!g.authReady || g.resuming) {
      screen = <Loading text={g.resuming ? 'Getting you back into your game…' : 'Loading…'} />;
    }
    else if (!g.profile) screen = <AuthScreen onSignUp={g.signUp} onLogIn={g.logIn} />;
    else {
      screen = (
        <Lobby
          profile={g.profile}
          rooms={g.rooms}
          celebs={celebs}
          friends={g.friends}
          onCreate={g.createRoom}
          onJoin={g.joinRoom}
          onLogOut={g.logOut}
          onSetPassword={g.setPassword}
          onRequestFriend={g.requestFriend}
          onRespondFriend={(username, accept) => g.emit('friends:respond', { username, accept })}
          onRemoveFriend={(username) => g.emit('friends:remove', { username })}
          onPlayWithFriend={g.playWithFriend}
        />
      );
    }
  } else if (state.phase === 'WAITING_FOR_PLAYER') {
    screen = <WaitingRoom state={state} friends={g.friends} onInvite={g.inviteToRoom} onLeave={g.leave} />;
  } else if (boardCelebs.length === 0) {
    screen = <Loading text="Loading board…" />;
  } else if (state.phase === 'SELECTING_CELEBRITY') {
    screen = <SelectionScreen state={state} celebs={boardCelebs} emit={g.emit} />;
  } else {
    screen = (
      <GameScreen
        state={state}
        celebs={boardCelebs}
        emit={g.emit}
        friends={g.friends}
        onRequestFriend={g.requestFriend}
        onAcceptFriend={acceptFriend}
        onLeave={g.leave}
      />
    );
  }

  return (
    <>
      {!g.connected && <div className="banner warn">Connecting to server…</div>}
      {g.error && <div className="toast">{g.error}</div>}
      {g.notice && <div className="toast ok">{g.notice}</div>}
      {g.invite && !state && (
        <div className="invite">
          <span><b>{g.invite.from}</b> invited you to play</span>
          <button className="btn primary small" onClick={g.acceptInvite}>JOIN</button>
          <button className="btn ghost small" onClick={g.dismissInvite}>✕</button>
        </div>
      )}
      {screen}
    </>
  );
}