# Koehn Scope Builder — Prototype

A browser-based scope/proposal editor styled from the Koehn Construction Services letterhead.

## Current prototype features

- Username/password sign-in stored locally in the browser.
- Two access levels: **Admin** and **Employee**.
  - The first account created in a browser becomes Admin.
  - Later accounts default to Employee.
  - Admins can change user roles in **Admin Settings**.
- Project dashboard with multiple saved scope projects.
- Project/client information fields.
- CSI MasterFormat division editor with enable/disable controls and paste-friendly scope boxes.
- Clarifications, exclusions, and alternates sections.
- **Client Selections** pricing section:
  - Add individual option/scope names.
  - Optional description.
  - Individual price field.
  - PDF prints an empty client checkbox for each item.
- **Admin-controlled Legal Disclaimer Library**:
  - Save multiple named disclaimer versions.
  - Admins may create, edit, and delete wording.
  - Employees may select an approved disclaimer per proposal but cannot alter its wording.
  - Two generic sample disclaimer versions are included only to demonstrate the workflow and should be replaced with KoehnCS-approved language.
- Final **Request to Proceed to Contract** acknowledgment with client/authorized representative, signature, and date lines.
  - Wording states the signature requests preparation/issuance of a formal contract.
  - It does not itself create a contract or authorize construction work.
- Live PDF preview.
- 8.5 x 11 in. portrait PDF output using Koehn orange, charcoal, logo, and triangle branding.
- Browser autosave.

## Running the prototype

For the simplest test, serve this folder with any basic static web server and open `index.html` in a current browser. The PDF exporter uses jsPDF from a CDN, so an internet connection is required for PDF export in this prototype.

## Prototype data/security note

Accounts, roles, projects, and disclaimer settings currently use browser `localStorage`. This is suitable for UI/workflow testing only. A production version should use server-side authentication and a shared database so permissions cannot be bypassed from the browser, employee work follows the user across devices, and company-wide disclaimer/user settings are centrally managed.
