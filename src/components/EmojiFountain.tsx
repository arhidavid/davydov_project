import { useMemo } from "react";

type Reaction = { id: string; emoji: string; createdAt: number };

// Deterministic pseudo-random in [0,1) from a string id, so each reaction keeps
// a stable horizontal position across re-renders.
function hashUnit(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function EmojiFountain({ reactions }: { reactions: Reaction[] }) {
  const items = useMemo(
    () =>
      reactions.map((r) => {
        const x = hashUnit(r.id);
        const drift = hashUnit(r.id + "d") * 40 - 20;
        return { ...r, left: 6 + x * 88, drift };
      }),
    [reactions],
  );

  return (
    <div className="fountain" aria-hidden>
      {items.map((r) => (
        <span
          key={r.id}
          className="fountain-item"
          style={{
            left: `${r.left}%`,
            ["--drift" as string]: `${r.drift}px`,
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
