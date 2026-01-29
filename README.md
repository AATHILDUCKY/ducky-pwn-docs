<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ducky Pwn Docs

Electron-wrapped intelligence command center built on React/Vite with local SQLite persistence for every project and finding.

## Run Locally

1. Install dependencies: `npm install`
2. Start both Vite and Electron: `npm run electron:dev`

## Production Build

1. Build the renderer: `npm run build`
2. Launch the packaged shell: `npm run electron:build`

## Data Persistence

Vault data is stored in SQLite at `${app.getPath('userData')}/ducky pwn docs/vault.db`, so all projects and findings survive across sessions.


## Open Source

- GitHub: https://github.com/AATHILDUCKY
- License: MIT

## Setup

	npm install
	npm run electron:dev

## Build

	npm run build
	npm run dist

## Security

Do not commit real SMTP credentials. Use .env.example as a template.
