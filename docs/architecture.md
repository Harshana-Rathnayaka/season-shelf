# Code organization

The renderer uses React and strict TypeScript throughout. Pages, dialogs and
reusable controls own their UI behaviour; application composition owns cross-feature
actions, state, discovery orchestration and document-level effects. The preload
boundary decodes external responses and events before they reach renderer state.
Electron and core services remain JavaScript and retain their existing boundaries.
See the [migration plan](react-migration.md) for validation and release status.

| Location | Responsibility |
| --- | --- |
| `src/core/` | Download scheduling, file integrity, persistence and episode rules; no DOM or Electron UI. |
| `src/desktop/main.cjs` | Application startup, service wiring, window lifecycle and IPC boundary. |
| `src/desktop/handlers/` | Feature IPC registration with injected services and confirmation dialogs. |
| `src/ui/app/` | Application composition: shell, React root, typed controller/state, IPC boundary, discovery orchestration and dialog host. |
| `src/ui/features/library/` | Library page, selection commands, selectors, types, sample catalogue and feature components. |
| `src/ui/features/downloads/` | Downloads page, queue commands, selectors, types, IPC contracts and feature components. |
| `src/ui/features/settings/`, `help/`, `discovery/` | React settings sections, help content and discovery dialogs. |
| `src/ui/shared/ui/` | Reusable buttons, async forms, pending-action hooks and icons; no feature state. |
| `src/ui/shared/lib/` | Byte/error formatting and JSON-boundary decoding primitives. |
| `dist/ui/` | Generated Vite output loaded by Electron and included in packages; not committed. |
| `src/ui/styles/` | Base, shell, feature, responsive and workspace styles. |

## Boundaries

- Organize renderer code by feature, with its page, `components/`, `actions.ts`,
  `selectors.ts` and `types.ts` together. Add these files only when needed.
  Do not recreate global folders for every file category.
- `app` composes features; features use shared UI and utilities. Shared code must
  not import features or app wiring. Feature-specific components stay with their
  feature until another feature actually needs them.
- Keep imports explicit; avoid barrel files that hide dependencies or create
  cycles. Put cross-feature orchestration in `app`, rather than reaching into
  another feature's components.
- Keep backend domain rules in `src/core` and privileged integrations in
  `src/desktop`. The renderer structure does not change these responsibilities.
- React components return JSX. Views receive
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
pages and dialogs. Background updates must preserve focused controls and unsaved
form values. Shell interactions use callbacks rather than delegated DOM events.

Run `npm.cmd test`, `npm.cmd run check`, and `node scripts/build-preview.mjs`
after changing renderer modules. Tests use synthetic files and mocked desktop
services. Live Telegram access is not needed for these checks.
