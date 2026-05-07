import { Hono } from "hono";
import { AppBindings } from "../types/types";
import { Scalar } from "@scalar/hono-api-reference";
import openApi from "../generated/openapi.json";

const docRoute = new Hono<AppBindings>()
    .get(
      "/scalar",
      Scalar({
        pageTitle: "API Documentation",
        sources: [
          {
            default: true,
            title: "Harune API",
            url: "/docs/openapi",
          },
          {
            title: "Better Auth",
            url: "/docs/auth-openapi",
          },
        ],
      }),
    )
    .get("/openapi", (c) => c.json(openApi))
    .get("/auth-openapi", async (c) => {
      const auth = c.get("auth");
      return c.json(await auth.api.generateOpenAPISchema());
    });

export default docRoute;
export type AppType = typeof docRoute;