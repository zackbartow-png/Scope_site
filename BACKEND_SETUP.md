# Scope Builder V7.42 — Shared Supabase Workspace

This build connects directly to the Koehn Scope Builder Supabase project. The public Supabase project URL and publishable key are intentionally included in the browser app. Security is enforced by Supabase Auth, Row Level Security, private Supabase Storage, and authenticated Edge Functions. No Supabase secret/service-role key is included in the website files.

## Temporary hosting architecture

- Vercel (or another static host) serves `index.html`, `app.js`, `styles.css`, and the locked marketing assets.
- Supabase Auth manages company users, passwords, invitations, and roles.
- Supabase Postgres stores the shared project records.
- Supabase private Storage stores kickoff quote-page snapshots and inline division images.
- Local browser storage/IndexedDB remains as a performance/offline cache.

This means a user can sign into the same deployed Scope Builder URL on another computer and load the same Supabase-backed projects. When Koehn's permanent website hosting is ready, move the static website files to the new host and keep the same Supabase backend.

## Cloud migration behavior

On the first V7.42 login from a browser that already contains Scope Builder projects, local and cloud copies are merged by project ID and most recent update timestamp. Existing local projects are uploaded to Supabase rather than erased. Legacy prototype projects stored under old local-only usernames are moved into the current Admin account during the first cloud migration so they are not stranded. Future project edits are saved locally immediately and synchronized to Supabase in the background.

Existing and new kickoff quote snapshots and inline division screenshots are uploaded to the private `scope-builder-assets` bucket. V7.42 checks the existing browser IndexedDB during the first cloud migration and uploads any assets that are not already in Supabase. On another computer they are downloaded into the local cache as needed.

## User removal

Admin → Users now includes **Remove User**. Removing a user:

1. Requires an Admin session.
2. Does not allow an Admin to remove their own account.
3. Prevents removal of the final Admin.
4. Transfers the removed user's projects and project-asset ownership to the Admin performing the removal.
5. Deletes the user's Supabase Auth account so they can no longer sign in.
6. Records the action in the Admin audit log.

## Current backend

- `profiles` — employee/admin role, status, password-change requirement
- `projects` — shared project records with complete project JSON
- `project_assets` — cloud asset metadata
- `app_settings` — shared Admin-controlled Terms & Conditions and estimating-office settings
- `admin_audit_log` — administrative action history
- `scope-builder-assets` — private Storage bucket for quote snapshots and kickoff division images
- RLS — employees can access their own projects/assets; Admins can access all company projects/assets
- Edge Functions — user list, invite, role change, temporary password, and remove user

## Current Admin

`zack.bartow@koehncs.com` is established as an Admin. New invited users default to Employee.

## Auth URL configuration

While testing on Vercel, set the deployed Scope Builder URL as the Supabase Auth Site URL and add any required preview URLs to Redirect URLs. When the permanent company host goes live, update this URL.

## Production email

Company-branded SMTP can wait until the `koehncs.com` DNS/hosting move is complete. Supabase's built-in mail service remains suitable only for limited testing.
