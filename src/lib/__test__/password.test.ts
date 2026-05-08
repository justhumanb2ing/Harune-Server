import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../password";

describe("password helpers", () => {
  it("hashes and verifies passwords with the worker-safe scrypt path", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    await expect(
      verifyPassword({
        hash,
        password: "correct horse battery staple",
      }),
    ).resolves.toBe(true);
  });

  it("rejects an invalid password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(
      verifyPassword({
        hash,
        password: "wrong password",
      }),
    ).resolves.toBe(false);
  });
});
