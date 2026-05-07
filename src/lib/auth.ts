import { betterAuth } from "better-auth";
import type { Context } from "hono";
import { AppBindings } from "../types/app-bindings";
import { hasedPassword } from "./password";
import { jwt, openAPI } from "better-auth/plugins";
import { jwtOptions } from "./jwt";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDB } from "./db";
import { getAllowedOrigins } from "../config/origins";

export const createAuth = (c: Context<AppBindings>) => betterAuth({
  appName: "Harune",
  secret: c.env.BETTER_AUTH_SECRET,
  baseURL: c.env.BETTER_AUTH_URL ?? "http://localhost:8787",
  basePath: "/auth",
  trustedOrigins: getAllowedOrigins(c.env),
  database: drizzleAdapter(createDB(c), {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: hasedPassword,
  },
  socialProviders: {
    google: {
      clientId: c.env.GOOGLE_CLIENT_ID as string,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  user: {
		fields: {
			emailVerified: "emailVerifiedBool",
		},
  },
  account: {
    storeStateStrategy: "cookie",
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
    },
  },
  session: {
    freshAge: 60 * 60 * 24 * 7,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
    deferSessionRefresh: true
  },
  advanced: c.env.BETTER_AUTH_URL?.includes("localhost")
    ? undefined
    : {
        crossSubDomainCookies: {
          enabled: true,
        },
    },
  experimental: { joins: true },
  plugins: [jwt(jwtOptions), openAPI()]
});
