> Historical record through 12 September 2026. May describe superseded behaviour. See [current documentation](../README.md).

# Channel filter keywords — review before enabling

The current list plus the explicitly approved standalone words signals, gold, profit, market and exchange are active defaults. Settings now supports editing this list. Other proposed additions below have NOT been integrated. Edit this file or send additions/removals in chat.

## Current active matches

Whole words, case-insensitive; punctuation and underscores act as separators:

`crypto`, `cryptocurrency`, `forex`, `bitcoin`, `binance`, `trading`, `trader`, `traders`, `airdrop`, `airdrops`, `nft`, `nfts`, `stock`, `stocks`, and the phrase `fx signal` / `fx signals`, plus `signals`, `gold`, `profit`, `market`, `exchange`.

Titles with explicit media words are retained and ranked first: movie(s), cinema, film(s), TV, series, season(s), episode(s), webseries, sitcom(s), anime, Netflix, Hollywood, Bollywood. The currently scanned channel is retained if valid episodes were found. Unknown names such as “12 Monkeys” remain visible. All channels bypasses the filter.

## Proposed additions — awaiting user review

| Category | Candidate words or phrases |
| --- | --- |
| Crypto services | ethereum, altcoin, altcoins, memecoin, memecoins, defi, token sale, presale, staking, crypto mining, blockchain, crypto wallet |
| Exchanges | bybit, bitget, kucoin, okx, gate io, mexc, coinbase |
| Trading services | brokerage, broker signals, trading signals, forex signals, copy trading, copytrade, binary options, stock market, share market, options signals, futures signals, technical analysis, prop firm, funded account |
| Trading platforms | metatrader, mt4, mt5, exness, quotex, pocket option, olymp trade |
| Promotional earning channels | referral earnings, daily earnings, online earning, earn money, investment returns, guaranteed returns, paid signals |
| Betting channels, if desired | betting tips, betting signals, casino, bookmaker, sports betting, bet365, 1xbet |

## Avoid hiding these words on their own

`VIP`, `premium`, `official`, `news`, `updates`, `money`, `business`, `bank`, `free`.

The user explicitly approved signals/gold/profit/market/exchange despite false-positive risk; they can be removed in Settings.

These occur in legitimate channel names and movie/show titles. Phrases reduce false positives. Even the current word “trading” can hide a show/movie title such as “Trading Places”; All channels is the recovery path.

## Proposed controls for later

- Editable keyword list is implemented. A preview of affected channels before saving remains future work.
- “Always show” overrides for individual channels, taking precedence over keywords.
- “Hidden by filter” view explaining which keyword matched.
- Persist successful media scan classification, instead of relying mainly on channel titles.

Approval of this document should specify which proposed categories/terms to enable. No memberships are changed and no channels are left by filtering.
