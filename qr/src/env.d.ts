interface Env {
  /** Public hackathon app URL encoded into the QR. Change without redeploying code. */
  TARGET_URL: string;
  /** Hosted Convex deployment the live dashboard subscribes to. */
  CONVEX_URL?: string;
}
