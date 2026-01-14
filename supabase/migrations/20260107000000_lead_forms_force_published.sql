update public.lead_forms
set status = 'published',
    config = jsonb_set(config, '{status}', '"published"', true),
    updated_at = now()
where status <> 'published';
