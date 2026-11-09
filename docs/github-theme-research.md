# GitHub colour theme research and implementation

Research date: 9 November 2026. Branch: feat/github-primer-theme.

## Findings

GitHub's product UI uses Primer, an open source design system, rather than one universal palette. Its light and dark modes have additional themes, including dimmed, contrast and colour-vision variants. Product colours should therefore be represented by their job in the interface. The useful lesson for Season Shelf is to change a small set of semantic CSS variables, keeping components independent of hexadecimal values. [Primer colour usage](https://primer.style/product/getting-started/foundations/color-usage/), [theme settings](https://docs.github.com/en/get-started/accessibility/managing-your-theme-settings).

Primer distinguishes base scales, functional tokens and component tokens. Functional roles describe foregrounds, backgrounds and borders; component tokens refine particular controls. Season Shelf already centralises colours in tokens.css, so adopting those roles fits the architecture without replacing React components or introducing an entire UI framework. [Token naming](https://primer.style/product/primitives/token-names/), [source repository](https://github.com/primer/primitives).

The familiar appearance comes from neutral page and inset surfaces, restrained borders, blue links/selection, green primary actions, and independent status colours. Marketing palettes and editor syntax themes serve different purposes and should not be used as the specification for a desktop application. Primer's documented values provide the light-mode reference. The dark palette is a GitHub-inspired adaptation, not a promise to match every current GitHub page pixel for pixel. [Colour reference](https://primer.style/product/primitives/color/).

Accessibility requires evaluating combinations, rather than selecting attractive swatches in isolation. GitHub describes correcting hundreds of contrast issues across more than a thousand use cases by changing its colour foundations. That supports testing text against both the page and raised surfaces, and separating button fills from accent text. The implementation adds contrast regression checks for default text, secondary text, links and statuses, plus primary-button text. [GitHub's contrast engineering article](https://github.blog/engineering/unlocking-inclusive-design-how-primers-color-system-is-making-github-com-more-inclusive/).

GitHub's Prism article explains tooling for producing and evaluating related palettes, including contrast and colour-vision themes. This supports keeping coherent role mappings across modes instead of mathematically inverting one palette. [Colour tooling article](https://github.blog/news-insights/product-news/accelerating-github-theme-creation-with-color-tooling/).

Searches also covered Medium and Reddit. Community results repeatedly distinguish editor themes from the website and point back to Primer; they are useful discovery leads, not technical specifications. Medium searches did not produce a stronger source than GitHub's own engineering articles. All implementation decisions above rely on primary sources. No user-comment claims about eye strain or download speed were treated as evidence.

## App mapping

| Role | Dark | Light | Application |
| --- | --- | --- | --- |
| Page | #0d1117 | #ffffff | Main workspace |
| Inset | #010409 | #f6f8fa | Sidebar |
| Raised surface | #151b23 | #ffffff | Panels and dialogs |
| Default text | #f0f6fc | #1f2328 | Content |
| Muted text | #9198a1 | #59636e | Descriptions and metadata |
| Border | #3d444d | #d1d9e0 | Panels and dividers |
| Accent foreground | #4493f8 | #0969da | Selection and navigation |
| Primary action | #238636 | #1f883d | Main action buttons, white text |
| Success | #3fb950 | #1a7f37 | Completed downloads, connection |
| Attention | #d29922 | #9a6700 | Waiting states |
| Danger | #f85149 | #d1242f | Errors and failed downloads |

The secondary dark text and some surfaces are app-specific choices. tokens.css is a deliberately small local palette; it does not ship the entire @primer/primitives distribution or add a runtime network dependency. Existing dark/light/system settings continue to work. Saved custom accent and text choices remain authoritative. Reset appearance removes those overrides, including the newly separate primary-action variables.

Primary buttons use green independently of blue selection. Completed downloads are green, failed downloads red and waiting downloads amber, with visible status labels retained. Default colour-picker values and the Windows startup/title bar colours match the new palette. The decorative page gradient and primary-button glow were removed, and panel corners tightened to support GitHub's restrained visual hierarchy. The app's layouts, icons and identity remain its own.

## Review and remaining validation

Reviewed renderer appearance application, stylesheet cascade, Electron isolation/IPC guards, credential persistence, download range buffering, queue writes, file publication and dependency advisories. This is a focused engineering review, not a penetration test or guarantee that every possible vulnerability has been eliminated.

An existing transfer path could previously be overwritten by copyFile, including when it was a symlink. Publication now uses COPYFILE_EXCL and only cleans up a temporary path successfully created by this attempt. Existing temporary-path collisions fail safely and leave the existing data intact; queue removal can clear an interrupted managed transfer before retrying. Regression coverage checks preservation of existing temporary data.

Security updates include ip-address, Electron 44.10.2, Vite and compatible nested build/test dependencies. Modern minimatch versions require an override to patched 11.x because affected older branches have no patched release in their original ranges. Older unaffected minimatch consumers are excluded from this override. [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249), [ip-address advisory](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5). Full npm audit returned zero vulnerabilities after installation.

Automated verification covers syntax, TypeScript, production build, queue/integrity tests and UI interaction tests. Browser visual verification was unavailable because the browser access host could not be reached. Default colours are contrast-tested, but user-supplied custom colours can still reduce contrast. Installer acceptance and live Telegram throughput require separate real-environment validation.

Final verification: 177 tests passed; syntax, TypeScript and Vite production build passed; git diff --check passed; full npm audit reported zero vulnerabilities. An unpacked Windows app built successfully with Electron 44.10.2 and the minimatch override. Packaging used the local Electron distribution and disabled executable resource editing/signing for this check; it did not create a release or exercise an installer. Build emitted Radix use-client bundling notices, with no build failure.
