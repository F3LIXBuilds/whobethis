import { useState } from 'react';

const USERNAME_OK = /^[A-Za-z0-9_]{3,16}$/;

export default function AuthScreen({ onSignUp, onLogIn }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const passwordOk = signup ? password.length >= 8 && password === confirm : password.length > 0;
  const valid = USERNAME_OK.test(username) && passwordOk;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    await (signup ? onSignUp(username, password) : onLogIn(username, password));
    setBusy(false);
  };

  const switchMode = (next) => {
    setMode(next);
    setConfirm('');
  };

  return (
    <main className="screen lobby">
      <div className="logo-wrap">
        <div className="ankara" />
        <h1 className="logo">WHO BE THIS?</h1>
        <p className="subtitle">Na who your opponent pick?</p>
        <div className="ankara" />
      </div>

      <div className="tabs two">
        <button type="button" className={!signup ? 'on' : ''} onClick={() => switchMode('login')}>LOG IN</button>
        <button type="button" className={signup ? 'on' : ''} onClick={() => switchMode('signup')}>CREATE ACCOUNT</button>
      </div>

      <form className="panel" onSubmit={submit}>
        <input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16))}
          placeholder="Username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
        />

        <div className="pw-wrap">
          <input
            name="password"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            maxLength={128}
          />
          <button type="button" className="pw-toggle" onClick={() => setShow(!show)}>
            {show ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        {signup && (
          <>
            <input
              name="confirm"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              maxLength={128}
            />
            {confirm && password !== confirm && (
              <p className="small-note" style={{ color: '#ff8a8e', margin: 0 }}>Passwords don’t match</p>
            )}
            <p className="muted small-note center">
              Username: 3-16 letters, numbers or underscores. Password: at least 8 characters.
              There’s no password reset yet, so keep it somewhere safe.
            </p>
          </>
        )}

        <button className="btn primary big" type="submit" disabled={!valid || busy}>
          {signup ? 'CREATE ACCOUNT' : 'LOG IN'}
        </button>
      </form>
    </main>
  );
}
