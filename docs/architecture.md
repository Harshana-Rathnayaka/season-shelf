# Code organization

Season Shelf uses native JavaScript modules, HTML templates and CSS. A UI
component is a rendering function with explicit inputs; it does not need a
framework or its own mutable application state.

| Location | Responsibility |
| --- | --- |
| `src/core/` | Download scheduling, file integrity, persistence and episode rules; no DOM or Electron UI. |
| `src/desktop/main.cjs` | Application startup, service wiring, window lifecycle and IPC boundary. |
| `src/desktop/handlers/` | Feature IPC registration with injected services and confirmation dialogs. |
| `src/ui/app.mjs` | Renderer state, application lifecycle, event delegation and DOM replacement. |
| `src/ui/pages/` | Compose complete Library, Downloads, Settings and Help views from explicit state. |
| `src/ui/components/` | Action buttons, shell, quality picker, download rows/actions and file details. |
| `src/ui/models/` | Pure display selection, ordering, counts and control eligibility. |
| `src/ui/actions/` | Feature interactions with explicit state, bridge and rendering dependencies. |
| `src/ui/format.mjs` | Shared escaping, byte formatting and readable errors. |
| `src/ui/styles/` | Base, shell, feature, responsive and workspace styles. |

## Boundaries

- Pages and components return markup. They do not call IPC, change global
  state, or find elements in the document. Keep DOM effects in the renderer
  controller or feature action handlers.
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

The desktop app and local HTTP preview load native ES modules. UI tests and the
standalone `docs/preview.html` share `scripts/lib/renderer-source.mjs`, which
follows the entry point's dependencies and preserves a scope for each module.
Its deliberately limited format supports relative named imports and declaration
exports; unsupported module syntax fails explicitly. New components no longer
need to be added to duplicate module lists.

Run `npm.cmd test`, `npm.cmd run check`, and `node scripts/build-preview.mjs`
after changing renderer modules. Tests use synthetic files and mocked desktop
services. Live Telegram access is not needed for these checks.
