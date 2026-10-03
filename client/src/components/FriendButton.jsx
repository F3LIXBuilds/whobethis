export default function FriendButton({ name, friends, onRequest, onAccept }) {
  if (friends.friends.some((f) => f.username === name)) {
    return <span className="friend-tag">✓ FRIENDS</span>;
  }
  if (friends.outgoing.includes(name)) return <span className="friend-tag">REQUEST SENT</span>;
  if (friends.incoming.includes(name)) {
    return <button className="btn primary small" onClick={() => onAccept(name)}>ACCEPT FRIEND</button>;
  }
  return <button className="btn ghost small" onClick={() => onRequest(name)}>+ ADD FRIEND</button>;
}