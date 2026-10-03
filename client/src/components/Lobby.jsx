import { useState } from 'react';
import Leaderboard from './Leaderboard.jsx';
import Friends from './Friends.jsx';
import Credits from './Credits.jsx';
import SetPassword from './SetPassword.jsx';

export default function Lobby({
  profile, rooms, celebs, friends,
  onCreate, onJoin, onLogOut, onSetPassword,
  onRequestFriend, onRespondFriend, onRemoveFriend, onPlayWithFriend,
}) {
  const [tab, setTab] = useState('play');
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');
  const [showCredits, setShowCredits] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (code.length === 6) onJoin(code);
  };


  return (
    <main className="screen lobby">
      <div className="logo-wrap">
        <div className="ankara" />
        <h1 className="logo">WHO BE THIS?</h1>
        <p className="subtitle">Na who your opponent pick?</p>
        <div className="ankara" />
      </div>

      <div className="account">
        <div>
          <b>{profile.username}</b>
          <small>{profile.games} games · {profile.confirmedWins} wins · {profile.snipeHits} snipes</small>
        </div>
        <button className="btn ghost small" onClick={onLogOut}>LOG OUT</button>
      </div>
      {!profile.hasPassword && <SetPassword onSave={onSetPassword} />}

      <div className="tabs">
        <button className={tab === 'play' ? 'on' : ''} onClick={() => setTab('play')}>PLAY</button>
        <button className={tab === 'friends' ? 'on' : ''} onClick={() => setTab('friends')}>
          👥 FRIENDS
          {friends.incoming.length > 0 && <i className="tab-badge">{friends.incoming.length}</i>}
        </button>
        <button className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>🏆 TOP</button>
      </div>

      {tab === 'play' && (
        <>
          <div className="panel">
            <button className="btn primary big" onClick={() => onCreate(isPublic)}>CREATE GAME</button>
            <label className="toggle">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              <span>List in open rooms (anyone can join)</span>
            </label>
          </div>

          <div className="panel">
            <h3>OPEN ROOMS <span className="live">● LIVE</span></h3>
            {rooms.length === 0 ? (
              <p className="muted center">No open rooms right now. Create one!</p>
            ) : (
              <ul className="rooms">
                {rooms.map((r) => (
                  <li key={r.code}>
                    <div>
                      <b>{r.host}</b>
                      <small>waiting for an opponent</small>
                    </div>
                    <button className="btn primary small" onClick={() => onJoin(r.code)}>JOIN</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={submit} className="panel join">
            <h3>HAVE A ROOM CODE?</h3>
            <input
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              }
              placeholder="ROOM CODE"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn" type="submit" disabled={code.length !== 6}>JOIN GAME</button>
          </form>
        </>
      )}

      {tab === 'friends' && (
        <Friends
          friends={friends}
          onRequest={onRequestFriend}
          onRespond={onRespondFriend}
          onRemove={onRemoveFriend}
          onPlay={onPlayWithFriend}
        />
      )}

      {tab === 'board' && <Leaderboard me={profile.username} />}

      <button className="link-btn" onClick={() => setShowCredits(true)}>Photo credits</button>
      {showCredits && <Credits celebs={celebs} onClose={() => setShowCredits(false)} />}
    </main>
  );
}