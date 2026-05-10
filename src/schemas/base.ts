import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

type CreditRecord = Record<string, number | undefined>;

export const users = pgTable("app_user", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name"),
	email: text("email").unique().notNull(),
	emailVerified: timestamp("emailVerified", { mode: "date" }),
	emailVerifiedBool: boolean("emailVerifiedBool").default(false).notNull(),
	image: text("image"),
	password: text("password"),
	createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
	updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	credits: jsonb("credits").$type<CreditRecord>().default({}),
	stripeCustomerId: text("stripeCustomerId"),
	stripeSubscriptionId: text("stripeSubscriptionId"),
	lemonSqueezyCustomerId: text("lemonSqueezyCustomerId"),
	lemonSqueezySubscriptionId: text("lemonSqueezySubscriptionId"),
	dodoCustomerId: text("dodoCustomerId"),
	dodoSubscriptionId: text("dodoSubscriptionId"),
	dodoSubscriptionAccessUntilAt: timestamp("dodoSubscriptionAccessUntilAt", {
		mode: "date",
	}),
	paddleCustomerId: text("paddleCustomerId"),
	paddleSubscriptionId: text("paddleSubscriptionId"),
	planId: text("planId"),
}).enableRLS();

export const authAccounts = pgTable(
	"auth_account",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		accountId: text("accountId").notNull(),
		providerId: text("providerId").notNull(),
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: text("accessToken"),
		refreshToken: text("refreshToken"),
		idToken: text("idToken"),
		accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
		refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("auth_account_provider_account_idx").on(
			table.providerId,
			table.accountId,
		),
		index("auth_account_userId_idx").on(table.userId),
	],
).enableRLS();

export const authSessions = pgTable(
	"auth_session",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
		ipAddress: text("ipAddress"),
		userAgent: text("userAgent"),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("auth_session_token_idx").on(table.token),
		index("auth_session_userId_idx").on(table.userId),
	],
).enableRLS();

export const authVerifications = pgTable(
	"auth_verification",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("auth_verification_identifier_value_idx").on(
			table.identifier,
			table.value,
		),
	],
).enableRLS();

export const authJwks = pgTable("jwks", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	publicKey: text("publicKey").notNull(),
	privateKey: text("privateKey").notNull(),
	createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
	expiresAt: timestamp("expiresAt", { mode: "date" }),
}).enableRLS();

export const baseSchema = {
	user: users,
	account: authAccounts,
	session: authSessions,
	verification: authVerifications,
	jwks: authJwks,
} as const;
