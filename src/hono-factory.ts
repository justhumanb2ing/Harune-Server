import { createFactory } from "hono/factory"
import { AppBindings } from "./types/app-bindings"
import { createAuth } from "./lib/auth";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { createDB } from "./lib/db";

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
  }
});
