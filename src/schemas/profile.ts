import { type SQL, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import {
	DEFAULT_PROFILE_BACKGROUND_BENTO_STYLE,
	DEFAULT_PROFILE_TEXT_BENTO_STYLE,
	type ProfileBackgroundBentoStyle,
	type ProfileTextBentoStyle,
} from "../lib/profile-text-style";
import type { ProfileImageCrop } from "../types/profile";
import { users } from "./base";

const authenticatedWriteRole = "authenticated";
const exposedReadRoles = ["anon", "authenticated"];

const currentBetterAuthUserId = sql`nullif(auth.jwt() ->> 'sub', '')`;

const isCurrentBetterAuthUser = (userIdColumn: AnyPgColumn) =>
	sql`${currentBetterAuthUserId} = ${userIdColumn}`;

export const hasProfileBento = (bentoIdColumn: AnyPgColumn) =>
	sql`exists (
    select 1
    from "profile_bento"
    join "profile_page" on "profile_page"."id" = "profile_bento"."profilePageId"
    where "profile_bento"."id" = ${bentoIdColumn}
  )`;

export const hasProfilePage = (profilePageIdColumn: AnyPgColumn) =>
	sql`exists (
    select 1
    from "profile_page"
    where "profile_page"."id" = ${profilePageIdColumn}
  )`;

export const isProfilePageOwner = (profilePageIdColumn: AnyPgColumn) =>
	sql`exists (
    select 1
    from "profile_page"
    where "profile_page"."id" = ${profilePageIdColumn}
      and "profile_page"."userId" = ${currentBetterAuthUserId}
  )`;

export const isProfileBentoOwner = (bentoIdColumn: AnyPgColumn) =>
	sql`exists (
    select 1
    from "profile_bento"
    join "profile_page" on "profile_page"."id" = "profile_bento"."profilePageId"
    where "profile_bento"."id" = ${bentoIdColumn}
      and "profile_page"."userId" = ${currentBetterAuthUserId}
  )`;

const publicSelectPolicy = (name: string, using: SQL) =>
	pgPolicy(name, {
		for: "select",
		to: exposedReadRoles,
		using,
	});

const ownerInsertPolicy = (name: string, withCheck: SQL) =>
	pgPolicy(name, {
		for: "insert",
		to: authenticatedWriteRole,
		withCheck,
	});

const ownerUpdatePolicy = (name: string, ownerCheck: SQL) =>
	pgPolicy(name, {
		for: "update",
		to: authenticatedWriteRole,
		using: ownerCheck,
		withCheck: ownerCheck,
	});

const ownerDeletePolicy = (name: string, using: SQL) =>
	pgPolicy(name, {
		for: "delete",
		to: authenticatedWriteRole,
		using,
	});

const withRlsPolicies = (
	tableName: string,
	publicSelectCheck: SQL,
	ownerCheck: SQL,
) => [
	publicSelectPolicy(`${tableName}_public_select`, publicSelectCheck),
	ownerInsertPolicy(`${tableName}_owner_insert`, ownerCheck),
	ownerUpdatePolicy(`${tableName}_owner_update`, ownerCheck),
	ownerDeletePolicy(`${tableName}_owner_delete`, ownerCheck),
];

export const profileBentoTypeEnum = pgEnum("profile_bento_type", [
	"link",
	"text",
	"clock",
	"section",
	"media",
	"map",
]);

export const profileBentoBreakpointEnum = pgEnum("profile_bento_breakpoint", [
	"desktop",
	"compact",
]);

export const profileMediaTypeEnum = pgEnum("profile_media_type", [
	"image",
	"video",
]);

export const profileImageCropSchema = jsonb(
	"imageCrop",
).$type<ProfileImageCrop | null>();

export const profilePages = pgTable(
	"profile_page",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("userId")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		handle: text("handle").notNull(),
		name: text("name"),
		location: text("location"),
		role: text("role"),
		bio: text("bio"),
		image: text("image"),
		imageCrop: profileImageCropSchema,
		backgroundImage: text("backgroundImage"),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("profile_page_handle_idx").on(table.handle),
		uniqueIndex("profile_page_user_id_idx").on(table.userId),
		...withRlsPolicies(
			"profile_page",
			sql`true`,
			isCurrentBetterAuthUser(table.userId),
		),
	],
).enableRLS();

export const profileBentos = pgTable(
	"profile_bento",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		profilePageId: text("profilePageId")
			.notNull()
			.references(() => profilePages.id, { onDelete: "cascade" }),
		type: profileBentoTypeEnum("type").notNull(),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		index("profile_bento_page_id_idx").on(table.profilePageId),
		...withRlsPolicies(
			"profile_bento",
			hasProfilePage(table.profilePageId),
			isProfilePageOwner(table.profilePageId),
		),
	],
).enableRLS();

export const profileBentoLayouts = pgTable(
	"profile_bento_layout",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bentoId: text("bentoId")
			.notNull()
			.references(() => profileBentos.id, { onDelete: "cascade" }),
		breakpoint: profileBentoBreakpointEnum("breakpoint").notNull(),
		x: integer("x").notNull(),
		y: integer("y").notNull(),
		w: integer("w").notNull(),
		h: integer("h").notNull(),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("profile_bento_layout_bento_breakpoint_idx").on(
			table.bentoId,
			table.breakpoint,
		),
		index("profile_bento_layout_bento_id_idx").on(table.bentoId),
		...withRlsPolicies(
			"profile_bento_layout",
			hasProfileBento(table.bentoId),
			isProfileBentoOwner(table.bentoId),
		),
	],
).enableRLS();

export const profileLinkBentos = pgTable(
	"profile_link_bento",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bentoId: text("bentoId")
			.notNull()
			.references(() => profileBentos.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		favicon: text("favicon"),
		thumbnail: text("thumbnail"),
		url: text("url").notNull(),
		domain: text("domain"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown> | null>()
			.default(null),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("profile_link_bento_bento_id_idx").on(table.bentoId),
		...withRlsPolicies(
			"profile_link_bento",
			hasProfileBento(table.bentoId),
			isProfileBentoOwner(table.bentoId),
		),
	],
).enableRLS();

export const profileTextBentos = pgTable(
	"profile_text_bento",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bentoId: text("bentoId")
			.notNull()
			.references(() => profileBentos.id, { onDelete: "cascade" }),
		content: text("content").notNull(),
		style: jsonb("style")
			.$type<ProfileTextBentoStyle>()
			.default(DEFAULT_PROFILE_TEXT_BENTO_STYLE)
			.notNull(),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("profile_text_bento_bento_id_idx").on(table.bentoId),
		...withRlsPolicies(
			"profile_text_bento",
			hasProfileBento(table.bentoId),
			isProfileBentoOwner(table.bentoId),
		),
	],
).enableRLS();

export const profileSectionBentos = pgTable(
	"profile_section_bento",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bentoId: text("bentoId")
			.notNull()
			.references(() => profileBentos.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
	},
	(table) => [
		uniqueIndex("profile_section_bento_bento_id_idx").on(table.bentoId),
		...withRlsPolicies(
			"profile_section_bento",
			hasProfileBento(table.bentoId),
			isProfileBentoOwner(table.bentoId),
		),
	],
).enableRLS();

export const profileMediaBentos = pgTable(
	"profile_media_bento",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bentoId: text("bentoId")
			.notNull()
			.references(() => profileBentos.id, { onDelete: "cascade" }),
		mediaType: profileMediaTypeEnum("mediaType").notNull(),
		url: text("url").notNull(),
		objectKey: text("objectKey").notNull(),
		href: text("href"),
		alt: text("alt").notNull(),
		caption: text("caption").notNull().default(""),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("profile_media_bento_bento_id_idx").on(table.bentoId),
		...withRlsPolicies(
			"profile_media_bento",
			hasProfileBento(table.bentoId),
			isProfileBentoOwner(table.bentoId),
		),
	],
).enableRLS();

export const profileMapBentos = pgTable(
	"profile_map_bento",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bentoId: text("bentoId")
			.notNull()
			.references(() => profileBentos.id, { onDelete: "cascade" }),
		latitude: doublePrecision("latitude").notNull(),
		longitude: doublePrecision("longitude").notNull(),
		zoom: integer("zoom").notNull(),
		caption: text("caption").notNull().default(""),
		url: text("url").notNull(),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("profile_map_bento_bento_id_idx").on(table.bentoId),
		...withRlsPolicies(
			"profile_map_bento",
			hasProfileBento(table.bentoId),
			isProfileBentoOwner(table.bentoId),
		),
	],
).enableRLS();

export const profileClockBentos = pgTable(
	"profile_clock_bento",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bentoId: text("bentoId")
			.notNull()
			.references(() => profileBentos.id, { onDelete: "cascade" }),
		timezone: text("timezone").notNull().default("Asia/Seoul"),
		showDate: boolean("showDate").notNull().default(true),
		showSeconds: boolean("showSeconds").notNull().default(true),
		style: jsonb("style")
			.$type<ProfileBackgroundBentoStyle>()
			.default(DEFAULT_PROFILE_BACKGROUND_BENTO_STYLE)
			.notNull(),
		createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
		updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("profile_clock_bento_bento_id_idx").on(table.bentoId),
		...withRlsPolicies(
			"profile_clock_bento",
			hasProfileBento(table.bentoId),
			isProfileBentoOwner(table.bentoId),
		),
	],
).enableRLS();
