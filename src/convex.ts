import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!url) {
  // Surface a clear message instead of a cryptic client error.
  console.error(
    "VITE_CONVEX_URL is not set. Run `npx convex dev` (it writes the URL " +
      "into .env.local), or set it in your hosting env.",
  );
}

export const convex = new ConvexReactClient(url ?? "");
