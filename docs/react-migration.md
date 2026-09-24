# React and TypeScript migration

Branch: `refactor/react-typescript`, based on current `master` (v1.1.0).

## Steps

1. **Foundation and shell:** add React, strict TypeScript and Vite; migrate navigation and the app shell; build local assets for Electron; replace the custom preview module loader with a standard bundler. Keep existing page behaviour working through an explicit temporary boundary.
2. **Downloads:** type download records and events; migrate rows, controls and tabs to React; replace delegated download events with component callbacks.
3. **Library:** migrate filters, quality selection, season tabs and episode selection; preserve keyboard focus and scrolling.
4. **Settings, help and dialogs:** migrate forms, account flows, confirmations and notifications; remove remaining HTML rendering and delegated handlers.
5. **State and IPC:** move renderer state into typed hooks/reducers, type the preload contract and validate external data at runtime. Convert shared/core modules incrementally without changing scheduling or storage semantics.
6. **Finish:** remove migration adapters and obsolete templates, update architecture documentation, run regression tests and desktop/package checks before PR/release.

## Rules

- New React modules use strict TypeScript. Existing JavaScript remains explicitly outside type checking until converted; no blanket `any` or `@ts-nocheck` in new components.
- React owns the shell, pages and dialogs. The remaining JavaScript controller is converted in the state/IPC stage.
- Keep existing CSS and selectors during conversion. Preserve context isolation, sandboxing, preload allowlists and the production content security policy.
- Preserve completed media, partial-file cleanup, queue concurrency and cumulative usage totals.
- Each step must pass existing behavioural tests, type checking and a production renderer build. Add regression coverage where ownership or behaviour changes.

This is an incremental migration, not a claim that adding a React root converts the whole application.

## Progress

Step 1 is implemented: React shell/navigation, strict TypeScript configuration,
Vite production assets, Electron/package wiring, rebuild-before-reload, and
esbuild-based tests/offline preview. All 135 tests pass, type checking and the
production build pass, and the built sample interface was inspected in Chrome.
Desktop installer execution and live Telegram were not exercised in this stage.
Step 2 is implemented: Downloads now uses typed React tabs, rows and controls,
typed commands and download IPC contracts. Stable keyed rows preserve focus and
scroll during progress updates; pending controls prevent duplicate requests.
Saving and verification phases have readable explanations. All 139 tests pass.
File details and Settings still use an explicit legacy action adapter.
Step 3 is implemented: Library uses typed React quality selection, season tabs,
episode rows, selection controls and local state commands. Search retains its
input/caret, selected rows retain focus and scroll, and Select all exposes a
mixed state. Shared async buttons prevent duplicate requests across both pages.
All 141 tests pass; type checking, production builds and the offline preview pass.
The built Library and Downloads views were inspected in Chrome, including sample
queue controls and dark/light themes. Live Telegram and installer execution have
not been exercised during these migration stages.
Step 4 is implemented: Settings sections, Help and all account/discovery/system
and file dialogs use typed React components. Shared async forms and buttons
prevent duplicate submissions. Dialog lifecycle state protects credentials and
ignores stale discovery responses; confirmations cancel once on Escape. The shell
owns account-menu state and focus, and document-wide action delegation is removed.
All 146 tests pass, strict TypeScript and production builds pass, and the offline
preview is regenerated. Unsaved settings survive usage/update events and failed
saves. No visual redesign was included in this stage.
Steps 5-6 remain; no migration release has been published.

Step 5 has started: application state and background-event reduction now have
explicit TypeScript types. Scan progress belongs to React state and survives
background queue renders; each new scan resets it. Settings and dialog callbacks
route directly to download commands, removing the legacy action adapter.
All 147 tests pass. Settings and the connection dialog were inspected in Chrome,
including Escape dismissal and focus restoration. The controller and full IPC
contract/runtime validation remain to be migrated before visual redesign.

The renderer now uses feature folders: Library and Downloads each own their page,
components, actions, selectors and types. Common controls live in `shared/ui`,
formatting in `shared/lib`, and composition in `app`. Settings, Help and discovery
also have feature homes for the remaining migration. See [architecture](architecture.md).
