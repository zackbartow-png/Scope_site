# Koehn Scope Builder – Prototype

A browser-based scope-writing prototype styled from the uploaded Koehn Construction Services letterhead.

## Current prototype features
- Local username/password account creation and sign-in (browser-local prototype only)
- Project dashboard with search and sorting
- Autosaved scope projects in browser localStorage
- Company, client, project, revision, estimator, and proposal information
- Active CSI MasterFormat divisions organized into dedicated scope boxes
- Clarifications, exclusions, and alternates sections
- Live US Letter portrait PDF preview
- Client-side PDF generation with repeating branded header/footer, page numbering, Koehn orange/grey accents, and triangle banding
- Responsive editor UI

## Run locally
Open `index.html` in a browser, or serve the folder with any static web server.

For best results, use a local server so browser asset loading behaves the same way it will when hosted.

Example:

```bash
python -m http.server 8080
```

Then open http://localhost:8080

## Important production note
The prototype login and saved data use localStorage so it can be tested immediately without external credentials. It is **not production authentication** and data does not sync between devices.

Recommended production upgrade:
- Host frontend on Vercel
- Supabase Auth for username/email + password authentication
- Supabase Postgres for users/projects/scope divisions
- Row Level Security so each user only sees their projects
- Optional organization/team sharing later

The UI/data model in this prototype is already structured so the local storage layer can be replaced with Supabase without redesigning the scope editor.
