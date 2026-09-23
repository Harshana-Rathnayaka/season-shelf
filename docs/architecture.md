# Code organization

Season Shelf is migrating to React and TypeScript. The shell and navigation are
React components checked with strict TypeScript. Downloads and Library also use
typed React components and command handlers; domain types and download IPC
contracts live in `src/ui/types/`. Settings and Help still use
JavaScript HTML renderers through an explicit `LegacyPage` boundary. See the
[migration plan](react-migration.md) for the remaining steps.

| Location | Responsibility |
| --- | --- |
| `src/core/` | Download scheduling, file integrity, persistence and episode rules; no DOM or Electron UI. |
| `src/desktop/main.cjs` | Application startup, service wiring, window lifecycle and IPC boundary. |
| `src/desktop/handlers/` | Feature IPC registration with injected services and confirmation dialogs. |
| `src/ui/app.mjs` | Transitional renderer state, application lifecycle, IPC integration and legacy dialog/settings event handling. |
| `src/ui/pages/` | Compose complete Library, Downloads, Settings and Help views from explicit state. |
| `src/ui/components/` | Action buttons, shell, quality picker, download rows/actions and file details. |
| `src/ui/components/library/`, `src/ui/components/downloads/` | Feature React components; share common buttons and icons from the parent directory. |
| `src/ui/react-renderer.tsx` | React root and temporary synchronous adapter for the existing controller. |
| `dist/ui/` | Generated Vite output loaded by Electron and included in packages; not committed. |
| `src/ui/models/` | Pure display selection, ordering, counts and control eligibility. |
| `src/ui/actions/` | Feature interactions with explicit state, bridge and rendering dependencies. |
| `src/ui/format.mjs` | Shared escaping, byte formatting and readable errors. |
| `src/ui/styles/` | Base, shell, feature, responsive and workspace styles. |

## Boundaries

- Legacy pages return markup; React components return JSX. React views receive
  typed action callbacks instead of calling IPC or changing global state. Local
  DOM effects (focus, scroll, mixed checkboxes) use refs within their owning component.
- Escape external values before inserting them into markup. Shared action
  buttons escape labels and data attributes centrally.
- Display predicates are shared by row controls, bulk controls and sample
  interactions. Backend validation remains authoritative.
- Desktop download handlers receive the queue, adapter, shell and confirmation
  service. Core file operations remain independent of Electron.
- Keep related orchestration together. Extract a module when it owns a distinct
  responsibility or removes real duplication, not to meet a line-count target.
- Preserve the order in `styles.css`: later workspace rules deliberately refine
  earlier feature styles. The stylesheet split retains the original cascade.

## Validation and standalone preview

Vite builds the renderer with relative asset URLs for Electron's `file:` loading.
Start, development, preview and packaging scripts build automatically. Development
reload rebuilds changed UI modules before refreshing the window. UI tests and the
standalone `docs/preview.html` bundle the same entry using esbuild; the old custom
module parser has been removed. The offline preview retains its hashed CSP.

`npm run check` checks JavaScript syntax, strict TypeScript and the production
renderer build. Existing JavaScript is not yet type checked. React owns the
shell; only `LegacyPage` allows the existing controller to own page DOM. Shell-only
updates must not replace that page DOM or disturb focused inputs.

Run `npm.cmd test`, `npm.cmd run check`, and `node scripts/build-preview.mjs`
after changing renderer modules. Tests use synthetic files and mocked desktop
services. Live Telegram access is not needed for these checks.
