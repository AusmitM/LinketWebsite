create unique index if not exists idx_tag_events_claim_operation_key_unique
  on public.tag_events ((metadata->>'entitlement_operation_key'))
  where event_type = 'claim'
    and metadata ? 'entitlement_operation_key';
