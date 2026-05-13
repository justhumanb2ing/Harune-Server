alter table profile_link_bento
	add column if not exists "domain" text default null;

update profile_link_bento
set "domain" = coalesce("domain", metadata ->> 'domain')
where "domain" is null and metadata ? 'domain';
