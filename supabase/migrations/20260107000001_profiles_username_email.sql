update public.profiles as p
set username = u.email,
    updated_at = now()
from auth.users as u
where p.user_id = u.id
  and (p.username is null or p.username = '' or p.username <> u.email);
