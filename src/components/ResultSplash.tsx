export function ResultSplash({
  kind,
  onBack,
}: {
  kind: "lost" | "winner";
  onBack: () => void;
}) {
  const title = kind === "winner" ? "you are a winner" : "you lost";
  return (
    <div className={`screen center splash splash--${kind}`}>
      <p className="splash-kicker">KPM Royale</p>
      <div className="splash-mark" aria-hidden="true">
        {kind === "winner" ? "👑" : "✊"}
      </div>
      <h1 className={`splash-title ${kind === "winner" ? "splash-title--win" : ""}`}>
        {title}
      </h1>
      <button type="button" className="btn btn-primary btn-lg" onClick={onBack}>
        Back to main menu
      </button>
    </div>
  );
}
