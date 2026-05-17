const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Harune <noreply@harune.me>";
const RESEND_USER_AGENT = "Harune API/1.0";

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export type SendResendEmailInput = {
	apiKey: string | undefined;
	to: string;
	subject: string;
	headline: string;
	body: string;
	actionLabel: string;
	actionUrl: string;
	from?: string;
};

export type SendResendTemplateEmailInput = {
	apiKey: string | undefined;
	to: string;
	templateId: string | undefined;
	variables?: Record<string, string | number | boolean | null>;
	from?: string;
};

export function buildTransactionalEmail(input: {
	headline: string;
	body: string;
	actionLabel: string;
	actionUrl: string;
}) {
	const escapedHeadline = escapeHtml(input.headline);
	const escapedBody = escapeHtml(input.body);
	const escapedActionLabel = escapeHtml(input.actionLabel);
	const escapedActionUrl = escapeHtml(input.actionUrl);

	return {
		html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f5f2;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#111827;">${escapedHeadline}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">${escapedBody}</p>
      <p style="margin:0 0 24px;">
        <a href="${escapedActionUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">${escapedActionLabel}</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
        If the button does not work, copy and paste this link:<br />
        <span style="word-break:break-all;">${escapedActionUrl}</span>
      </p>
    </div>
  </body>
</html>`,
		text: `${input.headline}\n\n${input.body}\n\n${input.actionLabel}: ${input.actionUrl}`,
	};
}

export async function sendResendEmail(input: SendResendEmailInput) {
	if (!input.apiKey) {
		throw new Error("RESEND_API_KEY is required to send account emails");
	}

	const email = buildTransactionalEmail({
		headline: input.headline,
		body: input.body,
		actionLabel: input.actionLabel,
		actionUrl: input.actionUrl,
	});

	const response = await fetch(RESEND_EMAIL_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
			"User-Agent": RESEND_USER_AGENT,
		},
		body: JSON.stringify({
			from: input.from ?? DEFAULT_FROM,
			to: input.to,
			subject: input.subject,
			html: email.html,
			text: email.text,
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`Resend email request failed with status ${response.status}${errorBody ? `: ${errorBody}` : ""}`,
		);
	}
}

export async function sendResendTemplateEmail(
	input: SendResendTemplateEmailInput,
) {
	if (!input.apiKey) {
		throw new Error("RESEND_API_KEY is required to send account emails");
	}

	if (!input.templateId) {
		throw new Error(
			"RESEND_DELETE_ACCOUNT_TEMPLATE_ID is required to send delete account emails",
		);
	}

	const response = await fetch(RESEND_EMAIL_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${input.apiKey}`,
			"Content-Type": "application/json",
			"User-Agent": RESEND_USER_AGENT,
		},
		body: JSON.stringify({
			from: input.from ?? DEFAULT_FROM,
			to: input.to,
			template: {
				id: input.templateId,
				variables: input.variables ?? {},
			},
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text().catch(() => "");
		throw new Error(
			`Resend email request failed with status ${response.status}${errorBody ? `: ${errorBody}` : ""}`,
		);
	}
}
