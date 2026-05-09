import DodoPayments from "dodopayments";
import type { Context } from "hono";

import type { AppBindings } from "../types/app-bindings";

function isHaruneProductionAuthUrl(authUrl?: string) {
	return (
		authUrl?.startsWith("https://") === true &&
		new URL(authUrl).hostname.endsWith(".harune.me")
	);
}

export function getDodoPaymentsEnvironment(c: Context<AppBindings>) {
	return isHaruneProductionAuthUrl(c.env.BETTER_AUTH_URL)
		? "live_mode"
		: "test_mode";
}

export function createDodoPaymentsClient(c: Context<AppBindings>) {
	return new DodoPayments({
		bearerToken: c.env.DODO_PAYMENTS_API_KEY,
		environment: getDodoPaymentsEnvironment(c),
	});
}
