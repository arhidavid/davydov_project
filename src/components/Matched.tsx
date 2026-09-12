export function Matched({
  emoji,
}: {
  emoji: string;
}) {
  return (
    <div className="screen center searching">
      <div className="searching-pulse" aria-hidden="true">
        {emoji}
      </div>
      <h1 className="searching-title">Matched!</h1>
      <p className="muted searching-copy">
        You&apos;re in a royal. Get ready to throw.
      </p>
    </div>
  );
}
