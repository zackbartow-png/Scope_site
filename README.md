# Koehn Scope Builder V7.14

# Koehn Scope Builder — V7.9

## V7.9 summary-page refinements
- Basic Summary now lists only the CSI divisions enabled in the proposal. Each Basic Summary description and amount is editable independently for that project.
- Basic Summary includes an optional Overhead line with editable label and amount.
- Advanced Summary divisions can be hidden from the summary without removing them from the proposal scope.
- Advanced Summary supports any number of editable subsection breakout rows under each division. If a Division Amount is entered it controls that division total; if left blank, the division total is calculated from its subsection amounts.
- Notes fields/columns were removed from both Basic and Advanced Summary pages.
- Additional Summary lines now support Section Subtotals. Each subtotal calculates only the cost lines entered since the previous subtotal. The subtotal is then carried into the grand total once, without double counting its underlying lines.
- Summary pages remain optional and continue to append after the proposal's existing final page. Locked cover/interior page design is unchanged.

# Koehn Scope Builder — V7.5

## V7.5 proposal/editor changes
- CSI division names are editable per project. Division numbers remain fixed; each division defaults to the standard name already provided in the app. Existing saved custom/default titles are preserved.
- PDF division cards no longer repeat the division number in orange. The locked orange corner triangle remains, while the heading is black: `DIVISION 01 - GENERAL REQUIREMENTS`.
- User-facing **Legal Disclaimer** wording has been renamed to **Terms & Conditions** throughout the project approval area, Admin library, preview, and PDF. The internal saved-data keys remain backward compatible.
- Terms & Conditions print immediately above the **Request to Proceed to Contract** acknowledgment/signature section.
- **Client Selections** has been renamed **Proposed Pricing**. Every project now always contains a fixed **Base Bid** pricing row, followed by user-added blank Alternate / Add-On rows.
- Existing price selections are preserved and migrate below the new Base Bid row. The Base Bid row cannot be removed.
- The locked Page 1 cover and Pages 2+ visual design, 12 pt PDF minimum, manual-line-break bullet rules, pagination/continuation rules, revision/archive/soft-delete safety, and Admin retention are unchanged.

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
- Admin-controlled Terms & Conditions library
- Proposed Pricing with permanent Base Bid plus alternate/add-on lines
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
3. Admin accounts export the complete workspace: users, roles, projects, Terms & Conditions, company info and project data.
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


## V7.6 – Live PDF Preview
- Replaced the old simplified preview with a live page-by-page rendering of the exact PDF export template.
- Preview updates automatically after edits and is vertically scrollable through all proposal pages.
- Preview attempts to preserve the user's relative scroll position when it refreshes.
- Proposed Pricing spacing now calculates the instruction-note height before placing the Base Bid row, preventing overlap/crowding.
- No locked cover/interior design changes were made in this update.

## V7.7 scrolling fix
- Restores reliable vertical scrolling in the proposal editor after the live PDF preview update.
- Editor workspace, CSI navigation, and PDF preview each scroll independently.
- Mouse-wheel/touchpad scrolling is no longer trapped by the preview pane at its scroll limits.
- No PDF design, pagination, proposal content, or persistence changes were made in this update.

## V7.8 – Optional Proposal Summary
- Added a new Proposal Summary editor tab.
- Summary modes are No Summary, Basic Summary, and Advanced Summary.
- Summary pages append after the existing final proposal page; locked cover/scope/closing pages are unchanged.
- Basic Summary automatically recaps the current Proposed Pricing Base Bid and alternate/add-on lines, with an optional summary note.
- Advanced Summary lists enabled CSI divisions with editable amount and notes fields, calculates Direct Cost Total, and supports additional cost/subtotal lines for fees, permits, bonds, allowances, contingency, etc.
- Advanced PDF styling is modeled on the uploaded cost-model summary concept: Description / Total / Notes columns, emphasized direct-cost, subtotal, and final-total bands, adapted to Koehn orange/charcoal branding.
- Summary pages use the existing 12 pt PDF minimum and appear in the live scrolling PDF preview.

## V7.10 Advanced Summary refinements
- If an Advanced Summary CSI Division Amount is blank, the division total cell remains blank on the PDF.
- Subsection amounts under a blank division still roll into Direct Cost Total and Proposal Summary Total.
- Added custom blank summary divisions that can be inserted at the top or immediately after any enabled CSI division.
- Custom summary divisions have editable description and total amount and are included in Direct Cost Total / grand total.
- Custom summary divisions affect only the Advanced Summary and do not create or modify scope divisions.
- Existing Additional Costs Section Subtotal behavior remains unchanged: each subtotal sums only the cost lines since the previous subtotal and rolls into the grand total once.

## V7.11 — Estimating Offices
- New projects require an Estimating Office selection: Fredonia or Tulsa.
- Existing projects default to Fredonia for backward compatibility.
- Admin Settings now includes an Offices tab with separate address and phone fields for Fredonia and Tulsa.
- The selected office is saved with each project and its address/phone drive the contact block on Page 1 of the PDF.
- Changing a project's Estimating Office refreshes that project to the latest saved contact information for the selected office.
- Office settings are included in full Admin backups and restored with workspace data.

## V7.13 — Division text formatting
- Added simple Bold, Italic, and Underline controls to every CSI division scope editor.
- Ctrl+B, Ctrl+I, and Ctrl+U work inside division scope fields.
- Formatting is stored per project/division and preserved by backups/revisions.
- Existing plain-text division scopes automatically migrate into the rich-text editor.
- Pasted scope content is inserted as plain text so outside Word/web formatting does not pollute the proposal style.
- Bold/Italic/Underline formatting is carried into the live PDF preview and exported PDF.
- Manual line-break bullet behavior and the 12 pt PDF minimum remain unchanged.


## V7.13 - Marketing Proposal Templates

- Page 1 export uses the Marketing-provided `Koehn Proposal.pdf` as the fixed branding master.
- Pages 2+ use the Marketing-provided `Koehn Blank Proposal Sheet.pdf` as the fixed branding master.
- The original PDFs are included unchanged under `assets/marketing/source/`.
- Website/export background derivatives only suppress the light-blue fill guides so live values render on a transparent/white field area.
- Original/base proposals omit the Revision icon, label, and value. V1+ proposals show the Marketing revision icon/label and the current revision value.
- Page numbering preserves the previous Scope Builder `PAGE X OF Y` lower-right style with orange underline.
- All existing project storage, revision history, summaries, rich text, office selection, and 12 pt PDF minimum remain in place.


## V7.14 Marketing icon fidelity fix
- Cover icons are taken pixel-for-pixel from the Marketing-provided Koehn Proposal PDF render.
- Only the pale blue form-guide pixels are removed in derived runtime cover assets.
- Original uploaded Marketing PDFs remain unchanged in assets/marketing/source.
- Original proposals suppress the entire Revision area; revised proposals retain the exact Marketing revision icon and label.
- Pages 2+ and prior page numbering/export behavior are unchanged.
