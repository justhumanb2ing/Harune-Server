import type { ScheduledController } from "@cloudflare/workers-types";

import honoFactory from "./hono-factory";
import { notFound } from "./lib/api-response";
import { createDatabaseClient } from "./lib/db";
import { handleHonoError } from "./lib/error-utils";
import { corsMiddleware } from "./middlewares/cors-middlewares";
import { csrfMiddleware } from "./middlewares/csrf-middleware";
import { sessionMiddleware } from "./middlewares/session-middleware";
import billingRoute from "./routes/billing-route";
import defaultRoute from "./routes/default-route";
import docRoute from "./routes/doc-route";
import handleRoute from "./routes/handle-route";
import meRoute from "./routes/me-route";
import metadataRoute from "./routes/metadata-route";
import profileRoute from "./routes/profile-route";
import { reconcileExpiredDodoSubscriptions } from "./services/dodo-subscription-cron";
import type { AppBindings } from "./types/app-bindings";

const app = honoFactory
	.createApp()
	.use(corsMiddleware)
	.use(csrfMiddleware)
	.use(sessionMiddleware)
	.onError(handleHonoError)
	.notFound((c) => notFound(c, "not_found", "route not found"))
	.on(["POST", "GET"], "/auth/*", (c) => {
		const auth = c.get("auth");
		return auth.handler(c.req.raw);
	})
	.route("/", defaultRoute)
	.route("/metadata", metadataRoute)
	.route("/handle", handleRoute)
	.route("/me", meRoute)
	.route("/users/me", meRoute)
	.route("/billing", billingRoute)
	.route("/profile", profileRoute)
	.route("/docs", docRoute);

export default {
	fetch: app.fetch.bind(app),
	async scheduled(
		_controller: ScheduledController,
		env: AppBindings["Bindings"],
	) {
		const dbClient = createDatabaseClient(env.HYPERDRIVE.connectionString);

		try {
			await reconcileExpiredDodoSubscriptions(dbClient.db);
		} finally {
			await dbClient.close();
		}
	},
};
