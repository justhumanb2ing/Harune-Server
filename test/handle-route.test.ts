import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { createHandleRoute } from "../src/routes/handle-route";
import type { AppBindings } from "../src/types/app-bindings";

type SessionState = {
  userId: string;
} | null;

function createTestApp({
  session,
  existingPage,
  ownedPage,
  updatedPage,
}: {
  session: SessionState;
  existingPage?: { userId: string; handle: string } | null;
  ownedPage?: { id: string; userId: string; handle: string; name: string | null; image: string | null } | null;
  updatedPage?: { id: string; userId: string; handle: string; name: string | null; image: string | null } | null;
}) {
  let requestedHandle: string | null = null;
  let updatedHandleInput: { id: string; handle: string } | null = null;
  let profilePageReadCount = 0;

  const route = createHandleRoute({
    findProfilePageByHandle: async (_db, handle) => {
      requestedHandle = handle;
      return existingPage ?? null;
    },
    findOwnedProfilePageByUserId: async (_db, userId) => {
      if (!ownedPage || ownedPage.userId !== userId) {
        return null;
      }

      return ownedPage;
    },
    findProfilePageByUserId: async (_db, userId) => {
      profilePageReadCount += 1;

      if (profilePageReadCount === 1) {
        if (!ownedPage || ownedPage.userId !== userId) {
          return null;
        }

        return ownedPage;
      }

      if (!updatedPage || updatedPage.userId !== userId) {
        return null;
      }

      return updatedPage;
    },
    updateProfilePageHandleById: async (_db, id, handle) => {
      updatedHandleInput = { id, handle };
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
    getUpdatedHandleInput: () => updatedHandleInput,
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

describe("PATCH /handle", () => {
  it("returns 401 when no session exists", async () => {
    const { app, getUpdatedHandleInput } = createTestApp({
      session: null,
    });

    const response = await app.request("/handle", {
      method: "PATCH",
      body: JSON.stringify({ handle: "new_handle" }),
      headers: {
        "content-type": "application/json",
      },
    });

    expect(response.status).toBe(401);
    expect(getUpdatedHandleInput()).toBeNull();
  });

  it("returns 400 for invalid handle payloads", async () => {
    const { app, getUpdatedHandleInput } = createTestApp({
      session: { userId: "user-1" },
    });

    const response = await app.request("/handle", {
      method: "PATCH",
      body: JSON.stringify({ handle: "not valid!" }),
      headers: {
        "content-type": "application/json",
      },
    });

    expect(response.status).toBe(400);
    expect(getUpdatedHandleInput()).toBeNull();
  });

  it("returns 404 when the current user does not own a profile page", async () => {
    const { app, getUpdatedHandleInput } = createTestApp({
      session: { userId: "user-1" },
      ownedPage: null,
    });

    const response = await app.request("/handle", {
      method: "PATCH",
      body: JSON.stringify({ handle: "new_handle" }),
      headers: {
        "content-type": "application/json",
      },
    });

    expect(response.status).toBe(404);
    expect(getUpdatedHandleInput()).toBeNull();
  });

  it("returns 409 when another user already owns the handle", async () => {
    const { app, getUpdatedHandleInput } = createTestApp({
      session: { userId: "user-1" },
      existingPage: { userId: "user-2", handle: "taken_handle" },
      ownedPage: {
        id: "page-1",
        userId: "user-1",
        handle: "current_handle",
        name: "Current",
        image: null,
      },
    });

    const response = await app.request("/handle", {
      method: "PATCH",
      body: JSON.stringify({ handle: "taken_handle" }),
      headers: {
        "content-type": "application/json",
      },
    });

    expect(response.status).toBe(409);
    expect(getUpdatedHandleInput()).toBeNull();
  });

  it("returns 200 no-op when the requested handle already matches the current canonical handle", async () => {
    const { app, getUpdatedHandleInput } = createTestApp({
      session: { userId: "user-1" },
      existingPage: {
        userId: "user-1",
        handle: "current_handle",
      },
      ownedPage: {
        id: "page-1",
        userId: "user-1",
        handle: "current_handle",
        name: "Current",
        image: null,
      },
    });

    const response = await app.request("/handle", {
      method: "PATCH",
      body: JSON.stringify({ handle: " CURRENT_HANDLE " }),
      headers: {
        "content-type": "application/json",
      },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      previousHandle: "current_handle",
      profilePage: {
        id: "page-1",
        handle: "current_handle",
        name: "Current",
        image: null,
      },
    });
    expect(getUpdatedHandleInput()).toBeNull();
  });

  it("updates the current user's handle and returns the committed profile page", async () => {
    const { app, getUpdatedHandleInput } = createTestApp({
      session: { userId: "user-1" },
      existingPage: null,
      ownedPage: {
        id: "page-1",
        userId: "user-1",
        handle: "current_handle",
        name: "Current",
        image: null,
      },
      updatedPage: {
        id: "page-1",
        userId: "user-1",
        handle: "new_handle",
        name: "Current",
        image: null,
      },
    });

    const response = await app.request("/handle", {
      method: "PATCH",
      body: JSON.stringify({ handle: "New_Handle" }),
      headers: {
        "content-type": "application/json",
      },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json).toEqual({
      previousHandle: "current_handle",
      profilePage: {
        id: "page-1",
        handle: "new_handle",
        name: "Current",
        image: null,
      },
    });
    expect(getUpdatedHandleInput()).toEqual({
      id: "page-1",
      handle: "new_handle",
    });
  });
});
