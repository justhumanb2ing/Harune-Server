import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { corsMiddleware } from "../src/middlewares/cors-middlewares";

describe("corsMiddleware", () => {
  it("allows PUT preflight for approved origins", async () => {
    const app = new Hono();
    app.use("*", corsMiddleware);

    const response = await app.request("http://localhost/handle", {
      method: "OPTIONS",
      headers: {
        Origin: "https://harune.me",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type, authorization, cache-control",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://harune.me");
    expect(response.headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(response.headers.get("access-control-allow-methods")).toContain("PUT");
    expect(response.headers.get("access-control-allow-methods")).toContain("DELETE");
    expect(response.headers.get("access-control-allow-headers")).toContain("Cache-Control");
  });
});
