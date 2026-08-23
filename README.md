# KoehnCS Scope Builder — Prototype

Open `index.html` in a modern browser.

## Current features
- Admin and Employee user levels
- Project/client/company information
- CSI division scope editor
- Clarifications, exclusions and alternates
- Admin-controlled legal disclaimer library
- Client selectable price items
- Request-to-proceed-to-contract acknowledgment and signature/date area
- US Letter portrait PDF export
- KoehnCS orange/charcoal/triangle branding
- Autosave

## Data persistence — important
This build introduces a stable, versioned workspace datastore:

`koehncs.scopeBuilder.data.v1`

When the app runs on the **same browser origin**, future builds can reuse this datastore and legacy `ksb:*` data is migrated automatically.

Downloaded prototype files/sandbox links may use different browser origins or file URLs. Browsers do not allow one origin to automatically read another origin's local storage. Because of that limitation, this prototype also includes a portable `.ksb` backup system.

### Before opening a different prototype build
1. Sign in to the current build.
2. Open the user menu and choose **Download Data Backup**.
3. Admin accounts export the complete workspace: users, roles, projects, disclaimers, company info and project data.
4. In the new build, choose **Restore Scope Builder Backup** from the login screen.
5. Select the `.ksb` file. Existing projects are merged rather than blindly replaced. When duplicate project IDs exist, the most recently updated copy is retained.

Admin users also have a **Data Backup** tab under Admin Settings.

## Production persistence
The permanent hosted version should use server-side authentication and a database. Once it is hosted on one permanent URL with database storage, projects will persist automatically across deployments and can follow authorized users between computers.

## Prototype security note
Passwords in this prototype are hashed in browser storage, but this local prototype is not a replacement for production authentication/security.
