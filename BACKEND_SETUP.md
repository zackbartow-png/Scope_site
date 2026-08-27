# Scope Builder V7.41 — Supabase Direct Auth

This build connects directly to the Koehn Scope Builder Supabase project. The public Supabase project URL and publishable key are intentionally included in the browser app. Security is enforced by Supabase Auth, Row Level Security, and authenticated Edge Functions. No Supabase secret/service-role key is included in the website files.

## Hosting

The website can be hosted on Vercel, the future Koehn company web host, or another static host. Supabase remains the authentication/database backend.

## Supabase backend now active

- `profiles` — employee/admin role, status, password-change requirement
- `projects` — cloud project records ready for Phase 2 migration
- `project_assets` — metadata for cloud screenshots/quote assets
- `app_settings` — company-controlled settings foundation
- `admin_audit_log` — administrative action history
- RLS policies — employees are limited to their own projects; Admins can read all projects
- Edge Functions — user list, user invite, Admin role changes, temporary passwords

## Auth URL configuration still required

In Supabase Authentication → URL Configuration, set the production Scope Builder URL as the Site URL and add any testing/preview URLs to Redirect URLs. Invite and password-reset emails must return to an approved URL.

## First Admin

The Supabase project currently has no Auth users. Create/invite the first account, then set that profile to Admin. Once one Admin exists, all future users should be invited from Scope Builder → Admin → Users and default to Employee.

## Production email

Supabase's built-in mailer is suitable for initial testing. Before production rollout, configure custom SMTP for reliable company invitations and password resets.
