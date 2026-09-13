# Channel filters

The suggested-channel view uses title keywords to reduce unrelated results. It does not leave channels, change memberships or prevent access. **All channels** bypasses this filter.

Edit or disable the keyword list in **Settings > Channel filtering**. Matching is case-insensitive and uses whole words/phrases; punctuation and underscores separate words. Explicit media titles are prioritised, unfamiliar titles remain visible, and a successfully scanned current series is retained.

Broad words can hide legitimate titles. Remove a matching term in Settings or use All channels if this happens. The built-in list is defined in `src/core/catalog.mjs`; user preferences can differ from the defaults.

Per-channel always-show overrides, an affected-channel preview and explanations of individual matches are future candidates in the [roadmap](ROADMAP.md). Only configured keywords affect filtering; roadmap proposals are not enabled defaults.
