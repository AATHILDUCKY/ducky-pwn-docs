<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ducky Pwn Docs

Local‑first security reporting and intelligence workspace built with Electron + React/Vite, backed by SQLite. Designed for fast, private report authoring, evidence capture, and deliverables generation — all on your machine.

## What This Is
Ducky Pwn Docs is a desktop app for red teamers, bug bounty hunters, and security consultants who need a clean workflow from findings → evidence → reports → email delivery. It runs offline, stores data locally, and produces professional output formats.

## Key Features
- Project Vault: organize clients, targets, and findings per project.
- Finding Management: severity, CVSS, assets, descriptions, custom fields.
- Markdown Notes: rich editor for tactical notes and methodologies.
- Evidence Attachments: images and videos with inline preview.
- Deliverables: generate PDF / HTML / DOCX reports.
- Email Send: SMTP settings, send finding reports with attachments.
- Report History: track sent reports with timestamped history.
- Local Persistence: SQLite database in user data directory.
- Offline‑ready: no cloud dependency required.

## Downloads (Desktop)
The desktop app will be distributed with downloadable installers:
- Linux: `.deb` and `.AppImage`
- Windows: `.exe` (NSIS installer)

A web landing page with download buttons is planned for the public release.

## Run Locally (Dev)
1) Install dependencies
```
npm install
```

2) Start Vite + Electron
```
npm run electron:dev
```

## Build Production (Desktop)
Build the renderer and package the app:
```
npm run build
npm run dist
```

### Linux (.deb)
```
npm run dist
```

### Windows (.exe)
Build on Windows (recommended):
```
npm run dist -- --win nsis
```

### macOS (.dmg / .zip)
Build on macOS:
```
npm run dist -- --mac
```

## Data Storage
All data is stored locally in SQLite:
```
${app.getPath('userData')}/ducky-pwn-docs/vault.db
```

Uploaded assets are stored alongside the database in:
```
${app.getPath('userData')}/ducky-pwn-docs/assets
```

## SMTP / Email
Configure SMTP settings inside the Profile page. Reports can be sent as PDF/HTML/DOCX with attachments. For security, never commit real SMTP credentials. Use `.env.example` as a template.

## Report Formats
- PDF: professional printable report
- HTML: email‑friendly layout
- DOCX: editable report for Office/Google Docs

## Roadmap
- Public download portal (web site)
- AppImage packaging for Linux
- Update channels

## Open Source
- License: MIT

## Credits
Created by AATHILDUCKY.

## Security
Do not commit secrets. Remove SMTP credentials from any tracked files before publishing.
