# Roadmap

This is a prioritised direction, not a release schedule. Features listed below are not promises of provider compatibility.

## Before the first public release

- Choose a source-code license.
- Configure Windows signing and Apple Developer signing/notarization credentials.
- Validate signed installation and an upgrade from an earlier installed version on Windows and macOS, including preservation of login, history and preferences.
- Complete live Telegram discovery, subscription, download/resume and collection acceptance checks. Measure transfer performance with comparable uncached files.
- Enable publishing only after those checks pass. See [releases](RELEASES.md).

## Next feature candidates

| Enhancement | Benefit / remaining work |
| --- | --- |
| Broader bot discovery | Capture links in attachments, replies sent as separate callback messages, late/edited replies and topic-specific flows |
| Alternate 1080p source | Search another provider and catalogue files delivered privately; requires its exact interaction flow |
| Clearer channel filtering | Preview affected channels, explain matches and allow per-channel always-show overrides |
| Per-series preferences | Remember more download defaults per series; consider optional language/media inspection |
| Completion integrations | Evaluate opt-in external notifications; WhatsApp delivery is not implemented and a free supported approach is not established |

## Maintainability

Extract larger renderer pages and IPC handlers incrementally while preserving existing integrity and security boundaries. See [architecture review](ARCHITECTURE_REVIEW.md). Add regression coverage for real failures rather than splitting files solely to meet a size target.

Already implemented: manual Unverified selection, app-history missing-episode checks, supported subscription joining/retry, hourly watches, scheduling and speed limits, tray operation, onboarding, metadata-only resets and installer/updater configuration. The [README](../README.md) describes current capabilities; [validation](VALIDATION.md) separates implementation from acceptance evidence.
