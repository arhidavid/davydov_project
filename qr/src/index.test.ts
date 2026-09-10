import { describe, expect, it } from "vitest";
import {
  qrMatrixToSvg,
  resolveTargetUrl,
  renderProjectorPage,
} from "./index";

describe("resolveTargetUrl", () => {
  it("prefers a valid ?url= query over env", () => {
    const url = new URL("https://qr.davydov-pr.com/?url=https://app.example.com/room");
    const result = resolveTargetUrl(url, "https://app.davydov-pr.com");
    expect(result.source).toBe("query");
    expect(result.target).toBe("https://app.example.com/room");
  });

  it("falls back to env TARGET_URL", () => {
    const url = new URL("https://qr.davydov-pr.com/");
    const result = resolveTargetUrl(url, "https://app.davydov-pr.com/");
    expect(result.source).toBe("env");
    expect(result.target).toBe("https://app.davydov-pr.com/");
  });

  it("rejects non-http schemes", () => {
    const url = new URL("https://qr.davydov-pr.com/?url=javascript:alert(1)");
    const result = resolveTargetUrl(url, "");
    expect(result.source).toBe("missing");
    expect(result.target).toBe("");
  });
});

describe("qrMatrixToSvg", () => {
  it("emits an svg with filled modules", () => {
    const svg = qrMatrixToSvg(
      [
        [true, false],
        [false, true],
      ],
      10,
    );
    expect(svg).toContain("<svg");
    expect(svg.match(/<rect/g)?.length).toBe(2);
  });
});

describe("renderProjectorPage", () => {
  it("includes the target URL and a QR svg", () => {
    const html = renderProjectorPage("https://app.davydov-pr.com", "env");
    expect(html).toContain("https://app.davydov-pr.com");
    expect(html).toContain("<svg");
    expect(html).toContain('data-source="env"');
  });
});
