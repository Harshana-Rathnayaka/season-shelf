# Download performance investigation

Compared the migration branch with the first release, `v1.0.0`.

- Telegram adapter, resumable range source, transfer limiter and Teleproto version
  were unchanged. Requests still use 512 KiB ranges and a bounded window of eight
  requests per file through the shared media scheduler (four on the fallback).
- The queue now releases network slots before verification/publication completes.
  Disk finishing is serialized and its backlog bounded. This can pause new work
  when disk finishing falls behind, but does not impose a network speed cap.
- The installed preferences inspected during diagnosis used two downloads and
  the default unlimited bandwidth setting.
- The supplied screenshots show 249.19 Mbps on a speed test (about 31 MB/s) and
  2.2 MB/s in the app. Different endpoints and test methods prevent attributing
  that gap to the app or Telegram from those screenshots alone.

One pipeline improvement was made: replenish the range window before yielding a
chunk to the staging writer. The next request can now overlap the current disk
write. The request window, cancellation, ordered bytes, resume alignment and
shared limiter remain bounded. A regression test holds the consumer after the
first chunk and verifies that its replacement request has already started.

No live Telegram throughput improvement has been measured. A same-file comparison
with Telegram Desktop on the same connection is still needed to distinguish
source/network throughput from an app-specific limitation. Do not claim the
speed-test rate as a guaranteed Telegram download rate.

## Destination metadata

New destinations no longer create `.season-shelf-root.json`. Device identity,
directory file ID and creation time are kept in app storage and checked before
writing. Replacing the directory at the same path still blocks publication.

At startup, legacy roots are verified using their existing marker. Settings,
download history and series watches are upgraded in one database transaction;
only then is a matching marker removed. Unavailable or changed destinations keep
their original checks and retry migration on a subsequent startup. Lifetime
usage counters and downloaded media are untouched by this migration.
