alter type profile_bento_type add value if not exists 'clock';

create table if not exists profile_clock_bento (
	"id" text primary key,
	"bentoId" text not null references profile_bento("id") on delete cascade,
	"timezone" text not null default 'Asia/Seoul',
	"showDate" boolean not null default true,
	"showSeconds" boolean not null default true,
	"createdAt" timestamp not null default now(),
	"updatedAt" timestamp not null default now()
);

create unique index if not exists profile_clock_bento_bento_id_idx
	on profile_clock_bento ("bentoId");

alter table profile_clock_bento enable row level security;

drop policy if exists profile_clock_bento_public_select on profile_clock_bento;
drop policy if exists profile_clock_bento_owner_insert on profile_clock_bento;
drop policy if exists profile_clock_bento_owner_update on profile_clock_bento;
drop policy if exists profile_clock_bento_owner_delete on profile_clock_bento;

create policy profile_clock_bento_public_select
	on profile_clock_bento
	for select
	to anon, authenticated
	using (
		exists (
			select 1
			from "profile_bento"
			join "profile_page" on "profile_page"."id" = "profile_bento"."profilePageId"
			where "profile_bento"."id" = profile_clock_bento."bentoId"
		)
	);

create policy profile_clock_bento_owner_insert
	on profile_clock_bento
	for insert
	to authenticated
	with check (
		exists (
			select 1
			from "profile_bento"
			join "profile_page" on "profile_page"."id" = "profile_bento"."profilePageId"
			where "profile_bento"."id" = profile_clock_bento."bentoId"
			  and "profile_page"."userId" = nullif(auth.jwt() ->> 'sub', '')
		)
	);

create policy profile_clock_bento_owner_update
	on profile_clock_bento
	for update
	to authenticated
	using (
		exists (
			select 1
			from "profile_bento"
			join "profile_page" on "profile_page"."id" = "profile_bento"."profilePageId"
			where "profile_bento"."id" = profile_clock_bento."bentoId"
			  and "profile_page"."userId" = nullif(auth.jwt() ->> 'sub', '')
		)
	)
	with check (
		exists (
			select 1
			from "profile_bento"
			join "profile_page" on "profile_page"."id" = "profile_bento"."profilePageId"
			where "profile_bento"."id" = profile_clock_bento."bentoId"
			  and "profile_page"."userId" = nullif(auth.jwt() ->> 'sub', '')
		)
	);

create policy profile_clock_bento_owner_delete
	on profile_clock_bento
	for delete
	to authenticated
	using (
		exists (
			select 1
			from "profile_bento"
			join "profile_page" on "profile_page"."id" = "profile_bento"."profilePageId"
			where "profile_bento"."id" = profile_clock_bento."bentoId"
			  and "profile_page"."userId" = nullif(auth.jwt() ->> 'sub', '')
		)
	);
