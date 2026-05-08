import { describe, expect, it } from "bun:test";

import { BASE_ORIGINS, getAllowedOrigins } from "../origins";

describe("getAllowedOrigins", () => {
  it("includes the configured Harune app origin and keeps entries unique", () => {
    const origins = getAllowedOrigins({
      HARUNE_APP_ORIGIN: "https://app.harune.me",
      FRONTEND_URL: "https://app.harune.me",
    });

    expect(origins).toEqual([
      ...BASE_ORIGINS,
      "https://app.harune.me",
    ]);
  });

  it("keeps an explicit frontend origin when it differs from the app origin", () => {
    const origins = getAllowedOrigins({
      HARUNE_APP_ORIGIN: "https://app.harune.me",
      FRONTEND_URL: "https://editor.harune.me",
    });

    expect(origins).toEqual([
      ...BASE_ORIGINS,
      "https://app.harune.me",
      "https://editor.harune.me",
    ]);
  });
});
