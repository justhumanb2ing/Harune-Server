import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import type { AppBindings } from "../../types/app-bindings";
import { createDeleteUserCallbackRoute } from "../delete-user-callback-route";

function createTestApp({
	findVerificationValue = vi.fn(),
}: {
	findVerificationValue?: ReturnType<typeof vi.fn>;
} = {}) {
	const deleteUser = vi.fn(async () => undefined);
	const deleteSessions = vi.fn(async () => undefined);
	const deleteAccounts = vi.fn(async () => undefined);
	const deleteVerificationByIdentifier = vi.fn(async () => undefined);

	const app = new Hono<AppBindings>();
	app.use("*", async (c, next) => {
		c.set("auth", {
			$context: Promise.resolve({
				internalAdapter: {
					findVerificationValue,
					deleteUser,
					deleteSessions,
					deleteAccounts,
					deleteVerificationByIdentifier,
				},
			}),
		} as never);
		await next();
	});
	app.route("/auth/delete-user/callback", createDeleteUserCallbackRoute());

	return {
		app,
		deleteUser,
		deleteSessions,
		deleteAccounts,
		deleteVerificationByIdentifier,
		findVerificationValue,
	};
}

describe("delete user callback route", () => {
	it("deletes the user without requiring a session cookie", async () => {
		const {
			app,
			deleteUser,
			deleteSessions,
			deleteAccounts,
			findVerificationValue,
			deleteVerificationByIdentifier,
		} = createTestApp({
			findVerificationValue: vi.fn(async () => ({
				value: "user-1",
				expiresAt: new Date("2026-08-16T00:00:00.000Z"),
			})),
		});

		const response = await app.request(
			"/auth/delete-user/callback?token=token-123&callbackURL=https%3A%2F%2Fharune.me%2Fsign-in",
			{ redirect: "manual" },
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://harune.me/sign-in");
		expect(findVerificationValue).toHaveBeenCalledWith(
			"delete-account-token-123",
		);
		expect(deleteUser).toHaveBeenCalledWith("user-1");
		expect(deleteSessions).toHaveBeenCalledWith("user-1");
		expect(deleteAccounts).toHaveBeenCalledWith("user-1");
		expect(deleteVerificationByIdentifier).toHaveBeenCalledWith(
			"delete-account-token-123",
		);
	});

	it("rejects requests without a token", async () => {
		const { app } = createTestApp();

		const response = await app.request("/auth/delete-user/callback");

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "validation_error",
				message: "token is required",
			},
		});
	});
});
