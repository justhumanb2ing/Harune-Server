import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

import { createHandleRoute } from "../src/routes/handle-route";
import type { AppBindings } from "../src/types/app-bindings";

type SessionState = {
  userId: string;
} | null;

function createTestApp({
  session,
  existingPage,
}: {
  session: SessionState;
  existingPage?: { userId: string; handle: string } | null;
}) {
  let requestedHandle: string | null = null;

  const route = createHandleRoute({
    findProfilePageByHandle: async (_db, handle) => {
      requestedHandle = handle;
      return existingPage ?? null;
    },
  });

  const app = new Hono<AppBindings>();
  app.use("*", async (c, next) => {
    c.set("db", {} as never);
    c.set("session", session as never);
    await next();
  });
  app.route("/handle", route);

  return {
    app,
    getRequestedHandle: () => requestedHandle,
  };
}

describe("GET /handle/check", () => {
  it("returns 400 when handle is missing", async () => {
    const { app, getRequestedHandle } = createTestApp({
      session: { userId: "user-1" },
    });

    const response = await app.request("/handle/check");

    expect(response.status).toBe(400);
    expect(getRequestedHandle()).toBeNull();
  });

  it("returns 400 for reserved handles after normalization", async () => {
    const { app, getRequestedHandle } = createTestApp({
      session: { userId: "user-1" },
    });

    const response = await app.request("/handle/check?handle=PROFILE");

    expect(response.status).toBe(400);
    expect(getRequestedHandle()).toBeNull();
  });

  it("returns 401 when no session exists", async () => {
    const { app, getRequestedHandle } = createTestApp({
      session: null,
    });

    const response = await app.request("/handle/check?handle=hello_world");

    expect(response.status).toBe(401);
    expect(getRequestedHandle()).toBeNull();
  });

  it("returns available false when another user owns the handle", async () => {
    const { app, getRequestedHandle } = createTestApp({
      session: { userId: "user-1" },
      existingPage: { userId: "user-2", handle: "mixed_name" },
    });

    const response = await app.request("/handle/check?handle=MiXeD_Name");
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ available: false });
    expect(getRequestedHandle()).toBe("mixed_name");
  });

  it("returns available true when the current user already owns the handle", async () => {
    const { app, getRequestedHandle } = createTestApp({
      session: { userId: "user-1" },
      existingPage: { userId: "user-1", handle: "mixed_name" },
    });

    const response = await app.request("/handle/check?handle=MiXeD_Name");
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ available: true });
    expect(getRequestedHandle()).toBe("mixed_name");
  });

  it("returns available true when no profile page exists", async () => {
    const { app, getRequestedHandle } = createTestApp({
      session: { userId: "user-1" },
      existingPage: null,
    });

    const response = await app.request("/handle/check?handle=hello_world");
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ available: true });
    expect(getRequestedHandle()).toBe("hello_world");
  });
});
