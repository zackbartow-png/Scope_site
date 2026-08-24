# Koehn Scope Builder — V7.4

Page 1 PDF cover updated to the approved compact cover layout. Pages 2 through the final page remain unchanged from V7.3.

Key cover details:
- Actual Koehn Construction Services logo is baked into the cover artwork with no white logo box.
- Smaller, distinct orange outline icons.
- Commercial building icon for Project.
- Phone corrected to 620.378.3002 (legacy 866.943.7751 values are corrected at export).
- Footer message reads “Building with integrity. Delivering with pride.”
- Original proposals omit the Revision block completely; V1/V2/etc. display it.

Existing locked PDF rules remain intact:
- Pages 2+ unchanged.
- 12 pt minimum live PDF text.
- Manual line breaks create bullets; automatic wrapping does not.
- Division continuation boxes use (CONT.) and fill available page space.
- Soft-delete/admin recovery, revisions, archive, roles, and backups remain unchanged.

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


## Current build changes
- Revision is optional; new projects leave it blank and the PDF omits it when unused.
- The standard document title is now **Proposal**. Older saved projects using the prior default **Scope of Work** migrate to **Proposal** automatically.
- Company Info is Admin-only in the editor. Employee users do not see or edit that tab, while the saved company branding/contact information still appears on proposal previews and PDF exports.


## Revision / archive / retention model
- Existing projects automatically become the Original revision.
- Revise duplicates the latest version into V1, V2, and so on while preserving the full prior version.
- Lock makes a specific revision read-only while still allowing PDF export.
- Archive moves the full project family to the Archived library without deleting it.
- Employee deletion is a soft removal: it disappears from that employee's project list, while Admin users retain the underlying proposal and can see its Removed by user status in All User Proposals.
- In this local prototype, admin visibility applies within the same saved workspace. The hosted production version should enforce the same model in the shared server database so retention works across computers and browsers.


## V6 deletion safety / recovery
- Users can delete an entire project family from the project card menu or delete only the currently opened version.
- Delete is always a soft delete. No project or revision is physically removed from the datastore.
- Employees no longer see deleted items in Active or Archived views.
- Admin users have a dedicated **Deleted Items** recovery view across all users.
- Deletion records retain the deleting username, deletion timestamp, and whether the action applied to a version or the project family.
- Admin can restore an entire deleted project family or an individual deleted revision.
- Deleted records remain included in Admin workspace backups, preserving recovery even when moving prototype builds.

## V7 locked proposal PDF design
- Page 1 uses the approved KoehnCS cover-sheet reference layout.
- Original/base proposals omit the Revision field entirely on Page 1. Revised proposals show V1, V2, and so on.
- Pages 2 through the last page use the locked charcoal left band, orange geometric accents, light-gray triangle background, Koehn header, rounded floating scope cards, and lower-right page numbering.
- The left band is decorative only: no division number, division name, website, or globe icon is shown there or in the footer.
- Multiple CSI divisions are packed onto each page whenever space allows.
- When a division crosses a page break, it is split into separate rounded cards and continuation cards append `(CONT.)` to the division title.
- Pagination is designed to use remaining page space rather than leaving unnecessary blank areas after a division.

## V7.2 PDF export cleanup
- Cover field values now render over clean cover masters instead of white masking boxes, eliminating doubled labels/text and the bottom-right white patch.
- Original proposals use a cover master with the Revision area removed; V1/V2/etc. use the revision cover master.
- Scope bullets are based only on explicit line breaks entered in the editor. A single running paragraph is not forced into a bullet, and automatic word wrapping never creates additional bullets.
- Division headings and division scope body text export at no less than 12 pt. Pagination/continuation boxes are used instead of shrinking division scope text.

## V7.3 12-point PDF minimum
- All live text generated by the PDF exporter now uses a hard minimum of 12 pt.
- This includes cover values/contact information, proposal/page identifiers, scope divisions, clarifications, exclusions, alternates, client selections, disclaimer text, acknowledgment text, and signature labels.
- Content is allowed to wrap, continue, or add pages rather than shrinking below 12 pt.
