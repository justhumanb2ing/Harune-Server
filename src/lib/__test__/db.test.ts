import { describe, expect, it, vi } from "vitest";

let drizzleCalls = 0;
let poolCalls = 0;

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: () => {
    drizzleCalls += 1;
    return { tag: "db" };
  },
}));

vi.mock("pg", () => ({
  Pool: class PoolMock {
    constructor() {
      poolCalls += 1;
    }
  },
}));

function createContext(connectionString: string) {
  const store = new Map<string, unknown>();

  return {
    env: {
      HYPERDRIVE: {
        connectionString,
      },
    },
    get(key: string) {
      return store.get(key);
    },
    set(key: string, value: unknown) {
      store.set(key, value);
    },
  } as never;
}

describe("createDB", () => {
  it("reuses the same database instance within a request", async () => {
    const { createDB } = await import("../db");

    const context = createContext("postgres://example/db");
    const first = createDB(context);
    const second = createDB(context);

    expect(first).toBe(second);
    expect(poolCalls).toBe(1);
    expect(drizzleCalls).toBe(1);
  });

  it("creates a fresh Pool for each request context", async () => {
    const { createDB } = await import("../db");

    const initialPoolCalls = poolCalls;
    const initialDrizzleCalls = drizzleCalls;

    createDB(createContext("postgres://example/db"));
    createDB(createContext("postgres://example/db"));

    expect(poolCalls - initialPoolCalls).toBe(2);
    expect(drizzleCalls - initialDrizzleCalls).toBe(2);
  });
});
