export function Searching({
  name,
  emoji,
  onCancel,
}: {
  name: string;
  emoji: string;
  onCancel: () => void;
}) {
  return (
    <div className="screen center searching">
      <div className="searching-pulse" aria-hidden="true">
        {emoji}
      </div>
      <h1 className="searching-title">Searching…</h1>
      <p className="muted searching-copy">
        {name}, looking for other players. You can cancel anytime.
      </p>
      <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
