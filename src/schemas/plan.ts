import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgPolicy, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const exposedReadRoles = ["anon", "authenticated"]

export type Quotas = {
  permiumSupport: boolean;
  monthlyImages: number;
  somethingElse: string;
};

export const defaultQuotas: Quotas = {
  permiumSupport: false,
  monthlyImages: 10,
  somethingElse: "something",
};

export const plans = pgTable(
  "plans",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    codename: text("codename").unique(),
    default: boolean("default").default(false),

    requiredCouponCount: integer("requiredCouponCount").default(0),

    hasOnetimePricing: boolean("hasOnetimePricing").default(false),
    hasMonthlyPricing: boolean("hasMonthlyPricing").default(false),
    hasYearlyPricing: boolean("hasYearlyPricing").default(false),

    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),

    monthlyPrice: integer("monthlyPrice"),
    monthlyPriceAnchor: integer("monthlyPriceAnchor"),
    monthlyStripePriceId: text("monthlyStripePriceId"),
    monthlyLemonSqueezyVariantId: text("monthlyLemonSqueezyVariantId"),
    monthlyDodoProductId: text("monthlyDodoProductId"),
    monthlyPaddlePriceId: text("monthlyPaddlePriceId"),
    monthlyPaypalPlanId: text("monthlyPaypalPlanId"),

    yearlyPrice: integer("yearlyPrice"),
    yearlyPriceAnchor: integer("yearlyPriceAnchor"),
    yearlyStripePriceId: text("yearlyStripePriceId"),
    yearlyLemonSqueezyVariantId: text("yearlyLemonSqueezyVariantId"),
    yearlyDodoProductId: text("yearlyDodoProductId"),
    yearlyPaddlePriceId: text("yearlyPaddlePriceId"),
    yearlyPaypalPlanId: text("yearlyPaypalPlanId"),

    onetimePrice: integer("onetimePrice"),
    onetimePriceAnchor: integer("onetimePriceAnchor"),
    onetimeStripePriceId: text("onetimeStripePriceId"),
    onetimeLemonSqueezyVariantId: text("onetimeLemonSqueezyVariantId"),
    onetimeDodoProductId: text("onetimeDodoProductId"),
    onetimePaddlePriceId: text("onetimePaddlePriceId"),
    onetimePaypalPlanId: text("onetimePaypalPlanId"),

    quotas: jsonb("quotas").$type<Quotas>(),
  },
  () => [
    pgPolicy("plans_public_select", {
      for: "select",
      to: exposedReadRoles,
      using: sql`true`,
    }),
  ]
).enableRLS();
