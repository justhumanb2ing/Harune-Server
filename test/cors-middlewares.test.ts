import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { corsMiddleware } from "../src/middlewares/cors-middlewares";

describe("corsMiddleware", () => {
  it("allows PATCH preflight for approved origins", async () => {
    const app = new Hono();
    app.use("*", corsMiddleware);

    const response = await app.request("http://localhost/handle", {
      method: "OPTIONS",
      headers: {
        Origin: "https://harune.me",
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "content-type, authorization",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://harune.me");
    expect(response.headers.get("access-control-allow-methods")).toContain("PATCH");
  });
});
