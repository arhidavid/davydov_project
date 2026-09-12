import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONVEX_URL,
  isAllowedConvexUrl,
  renderDashboardPage,
  resolveConvexUrl,
} from "./dashboard";
import worker from "./index";

const env = {
  TARGET_URL: "https://app.davydov-pr.com",
  CONVEX_URL: "https://artful-dog-585.eu-west-1.convex.cloud",
};

describe("resolveConvexUrl", () => {
  it("allows convex.cloud and localhost", () => {
    expect(isAllowedConvexUrl("https://artful-dog-585.eu-west-1.convex.cloud")).toBe(
      true,
    );
    expect(isAllowedConvexUrl("http://127.0.0.1:3210")).toBe(true);
    expect(isAllowedConvexUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedConvexUrl("https://evil.example")).toBe(false);
  });

  it("prefers ?convex= over env", () => {
    const url = new URL(
      "https://qr.davydov-pr.com/dashboard?convex=http://127.0.0.1:3210",
    );
    const result = resolveConvexUrl(url, env.CONVEX_URL);
    expect(result.source).toBe("query");
    expect(result.url).toBe("http://127.0.0.1:3210");
  });

  it("falls back to env then the hosted default", () => {
    const url = new URL("https://qr.davydov-pr.com/dashboard");
    expect(resolveConvexUrl(url, env.CONVEX_URL).source).toBe("env");
    expect(resolveConvexUrl(url, undefined).url).toBe(DEFAULT_CONVEX_URL);
  });
});

describe("renderDashboardPage", () => {
  it("shows live stat labels and the Convex query", () => {
    const html = renderDashboardPage({
      target: "https://app.davydov-pr.com",
      targetSource: "env",
      convexUrl: env.CONVEX_URL,
      qrSvg: "<svg></svg>",
    });
    expect(html).toContain("Real players");
    expect(html).toContain("In queue");
    expect(html).toContain("Live matches");
    expect(html).toContain("Most popular gesture");
    expect(html).toContain("stats:live");
    expect(html).toContain(env.CONVEX_URL);
  });
});

describe("worker routes", () => {
  it("serves /dashboard as HTML", async () => {
    const res = await worker.fetch(
      new Request("https://qr.davydov-pr.com/dashboard"),
      env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("KPM Royale");
    expect(html).toContain("stat-queued");
    expect(html).toContain("stats:live");
  });

  it("keeps GET /target as JSON", async () => {
    const res = await worker.fetch(
      new Request("https://qr.davydov-pr.com/target"),
      env,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      url: "https://app.davydov-pr.com/",
      source: "env",
    });
  });
});
