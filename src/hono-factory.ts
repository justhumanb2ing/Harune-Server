import { createFactory } from "hono/factory";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import type { AppBindings } from "./types/app-bindings";

export default createFactory<AppBindings>({
	initApp: (app) => {
		app.use(logger());
		app.use(prettyJSON());
	},
});
