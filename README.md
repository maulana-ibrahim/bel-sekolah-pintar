# Bel Sekolah Pintar

Offline school bell scheduler for Windows. It rings the active template's bells
on the chosen speaker / PA system, runs from the system tray, and can start at
Windows login. No server, no internet: everything runs inside the one app.

- **UI:** React + TypeScript + Tailwind v4 + shadcn/ui (`src/`)
- **Engine:** Rust inside the same app via Tauri v2 (`src-tauri/src/`): the
  1-second scheduler, audio playback (rodio), sound files, the data file and the tray.

## Develop

Needs Node 22, pnpm 10 and Rust (stable).

```bash
pnpm install
pnpm tauri dev   # run the app
pnpm test        # TypeScript data rules + Rust tests
```

## Release

Push a version tag; GitHub Actions builds the Windows installers and publishes
a GitHub Release with them:

```bash
# bump "version" in package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml
git tag v0.2.0 && git push origin v0.2.0
```

The installers are not code-signed yet, so Windows SmartScreen asks for
"More info → Run anyway" on first install.

## Where the data lives (Windows)

`%APPDATA%\id.sch.belsekolahpintar\`

- `data.json`: templates, bells, bell types, quick bells, settings
- `sounds\`: copied sound files
- `bel.log`: bells that failed to ring, and why
- `data.corrupt-*.json`: unreadable data files, kept aside (never deleted)

## Running it at a school

The PC must be on and logged in for bells to ring: set the power plan to never
sleep and turn on Windows auto-login, then enable "Jalan otomatis" in Pengaturan.
