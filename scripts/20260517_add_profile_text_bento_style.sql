alter table profile_text_bento
	add column if not exists "style" jsonb;

update profile_text_bento
	set "style" = '{"backgroundColor":"#ffffff","textAlign":"start"}'::jsonb
	where "style" is null;

alter table profile_text_bento
	alter column "style" set default '{"backgroundColor":"#ffffff","textAlign":"start"}'::jsonb;

alter table profile_text_bento
	alter column "style" set not null;
