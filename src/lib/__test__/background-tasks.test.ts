import { describe, expect, it, vi } from "vitest";

import { createBackgroundTaskHandler } from "../background-tasks";

describe("createBackgroundTaskHandler", () => {
  it("forwards deferred work to waitUntil when an execution context exists", () => {
    const waitUntil = vi.fn();
    const handler = createBackgroundTaskHandler({
      executionCtx: {
        waitUntil,
      },
    } as never);

    const deferred = Promise.resolve();
    handler(deferred);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0]?.[0]).toBeInstanceOf(Promise);
  });

  it("swallows rejected deferred work after logging it", async () => {
    const waitUntil = vi.fn();
    const error = new Error("boom");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = createBackgroundTaskHandler({
      executionCtx: {
        waitUntil,
      },
    } as never);

    handler(Promise.reject(error));

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await expect(waitUntil.mock.calls[0]?.[0]).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to run deferred Better Auth task:",
      error,
    );
    consoleError.mockRestore();
  });
});
