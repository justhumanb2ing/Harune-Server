alter table profile_text_bento
	alter column "style" set default '{"backgroundColor":"#ffffff","textAlign":"start","verticalAlign":"start"}'::jsonb;

update profile_text_bento
	set "style" = jsonb_set(
		coalesce("style", '{}'::jsonb),
		'{verticalAlign}',
		'"start"'::jsonb,
		true
	)
	where "style" is not null;
