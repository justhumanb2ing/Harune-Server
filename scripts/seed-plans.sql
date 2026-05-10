insert into plans (id, name, codename, "default", quotas)
values (
  'plan_free',
  'Free',
  'free',
  true,
  '{"features":{"customHandleChange":true},"limits":{"handleChangesPerMonth":1,"maxProfilePages":1}}'::jsonb
)
on conflict (codename) do update
set
  name = excluded.name,
  "default" = excluded."default",
  quotas = excluded.quotas;

insert into plans (
  id,
  name,
  codename,
  "default",
  "hasMonthlyPricing",
  "monthlyPrice",
  "monthlyDodoProductId",
  quotas
)
values (
  'plan_pro',
  'Pro',
  'pro',
  false,
  true,
  399,
  'pdt_0NeT4l9x1OIj74GdAQvVH',
  '{"features":{"customHandleChange":true},"limits":{"handleChangesPerMonth":5,"maxProfilePages":3}}'::jsonb
)
on conflict (codename) do update
set
  name = excluded.name,
  "default" = excluded."default",
  "hasMonthlyPricing" = excluded."hasMonthlyPricing",
  "monthlyPrice" = excluded."monthlyPrice",
  "monthlyDodoProductId" = excluded."monthlyDodoProductId",
  quotas = excluded.quotas;
