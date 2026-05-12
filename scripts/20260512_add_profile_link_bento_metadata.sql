alter table profile_link_bento
	add column if not exists "metadata" jsonb default null;
