import { useState } from 'react';

export default function SetPassword({ onSave }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (pw.length < 8 || busy) return;
    setBusy(true);
    const r = await onSave(pw);
    setBusy(false);
    if (r?.ok) setPw('');
  };

  return (
    <form className="panel" onSubmit={save}>
      <h3>🔒 SECURE YOUR ACCOUNT</h3>
      <p className="muted small-note">
        Set a password so you can log in from any device. Without one, clearing your browser data loses this account.
      </p>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="New password (8+ characters)"
        autoComplete="new-password"
        maxLength={128}
      />
      <button className="btn primary" type="submit" disabled={pw.length < 8 || busy}>SAVE PASSWORD</button>
    </form>
  );
}
