alter table app_user
	add column if not exists "dodoSubscriptionAccessUntilAt" timestamp;
