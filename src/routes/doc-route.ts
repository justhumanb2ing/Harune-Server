import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import openApi from "../generated/openapi.json";
import { getAuth } from "../lib/auth";
import type { AppBindings } from "../types/app-bindings";

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
		const auth = getAuth(c);
		return c.json(await auth.api.generateOpenAPISchema());
	});

export default docRoute;
export type AppType = typeof docRoute;
