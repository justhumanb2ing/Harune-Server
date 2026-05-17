import { afterEach, describe, expect, it, vi } from "vitest";

import {
	buildTransactionalEmail,
	sendResendEmail,
	sendResendTemplateEmail,
} from "../resend";

describe("buildTransactionalEmail", () => {
	it("renders escaped html and plain text content", () => {
		const email = buildTransactionalEmail({
			headline: "Delete <account>",
			body: "Confirm & continue",
			actionLabel: "Go now",
			actionUrl: "https://example.com/delete?token=abc&next=<done>",
		});

		expect(email.html).toContain("Delete &lt;account&gt;");
		expect(email.html).toContain("Confirm &amp; continue");
		expect(email.html).toContain(
			"https://example.com/delete?token=abc&amp;next=&lt;done&gt;",
		);
		expect(email.text).toContain("Delete <account>");
		expect(email.text).toContain("Confirm & continue");
	});
});

describe("sendResendEmail", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("posts a transactional email to Resend", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "email_123" }), {
				status: 200,
				headers: {
					"content-type": "application/json",
				},
			}),
		);

		await sendResendEmail({
			apiKey: "re_test",
			to: "user@example.com",
			subject: "Verify your Harune email",
			headline: "Verify your Harune email",
			body: "Use the button below to confirm this email address and continue using Harune.",
			actionLabel: "Verify email",
			actionUrl: "https://example.com/verify",
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.resend.com/emails",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer re_test",
					"Content-Type": "application/json",
					"User-Agent": "Harune API/1.0",
				}),
			}),
		);
	});

	it("throws when Resend returns an error", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("invalid", {
				status: 400,
			}),
		);

		await expect(
			sendResendEmail({
				apiKey: "re_test",
				to: "user@example.com",
				subject: "Verify your Harune email",
				headline: "Verify your Harune email",
				body: "Use the button below to confirm this email address and continue using Harune.",
				actionLabel: "Verify email",
				actionUrl: "https://example.com/verify",
			}),
		).rejects.toThrow("Resend email request failed with status 400");
	});
});

describe("sendResendTemplateEmail", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("posts a transactional template email to Resend", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ id: "email_123" }), {
				status: 200,
				headers: {
					"content-type": "application/json",
				},
			}),
		);

		await sendResendTemplateEmail({
			apiKey: "re_test",
			to: "user@example.com",
			templateId: "tmpl_delete_account",
			variables: {
				ACTION_URL: "https://example.com/delete?token=abc",
			},
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.resend.com/emails",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer re_test",
					"Content-Type": "application/json",
					"User-Agent": "Harune API/1.0",
				}),
				body: JSON.stringify({
					from: "Harune <noreply@harune.me>",
					to: "user@example.com",
					template: {
						id: "tmpl_delete_account",
						variables: {
							ACTION_URL: "https://example.com/delete?token=abc",
						},
					},
				}),
			}),
		);
	});

	it("throws when template id is missing", async () => {
		await expect(
			sendResendTemplateEmail({
				apiKey: "re_test",
				to: "user@example.com",
				templateId: undefined,
				variables: {
					ACTION_URL: "https://example.com/delete?token=abc",
				},
			}),
		).rejects.toThrow(
			"RESEND_DELETE_ACCOUNT_TEMPLATE_ID is required to send delete account emails",
		);
	});
});
