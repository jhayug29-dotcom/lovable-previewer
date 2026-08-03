-- Grant admin access to the owner account (already applied for growchannel2026@gmail.com).
-- Safe to re-run. Change the email to add another admin.

insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = lower('growchannel2026@gmail.com')
on conflict (user_id, role) do nothing;

-- Give every existing account a base 'user' role and a profile row
-- (accounts created before the signup trigger existed).
insert into public.user_roles (user_id, role)
select u.id, 'user'::public.app_role from auth.users u
on conflict (user_id, role) do nothing;

insert into public.profiles (id, email, full_name)
select u.id, u.email, u.raw_user_meta_data->>'full_name' from auth.users u
on conflict (id) do nothing;

-- Check who is an admin:
-- select u.email, r.role from public.user_roles r join auth.users u on u.id = r.user_id;
