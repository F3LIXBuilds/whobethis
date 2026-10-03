export default function History({ history, me, players }) {
  if (!history.length) return null;
  return (
    <details className="history">
      <summary>Question log ({history.length})</summary>
      <ol>
        {history.map((h, i) => (
          <li key={i}>
            <b>{h.by === me ? 'You' : players[h.by].name}:</b> {h.text}{' '}
            <span className={`ans ${h.answer === 'YES' ? 'y' : 'n'}`}>{h.answer}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}