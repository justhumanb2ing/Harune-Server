import { createFactory } from "hono/factory";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { createAuth } from "./lib/auth";
import { createDB } from "./lib/db";
import type { AppBindings } from "./types/app-bindings";

export default createFactory<AppBindings>({
	initApp: (app) => {
		app.use(logger());
		app.use(prettyJSON());
		app.use(async (c, next) => {
			createDB(c);
			const auth = createAuth(c);
			c.set("auth", auth);
			await next();
		});
	},
});
