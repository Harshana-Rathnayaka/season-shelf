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

## November 2026 investigation

The network path still uses 512 KiB requests, eight bounded requests per file through Teleproto's media scheduler (four on the fallback), ordered delivery, cancellation, shared bandwidth limiting and pipelined disk writes. The installed scheduler starts two media sessions and adapts its windows. Blindly increasing requests could increase memory, flood waits and contention; no live evidence justified changing those limits. Telegram documents constraints on request alignment and size: https://core.telegram.org/api/files.

File verification previously used Node's default 64 KiB read stream buffer. It now uses 1 MiB, reducing stream chunks by 16 times while retaining full SHA-256 verification and bounded memory. This helps local finishing, which can backpressure the queue when destinations are slow. It does not change network bandwidth or remove integrity checks.

Local Windows benchmark: a generated 256 MiB file, six sequential reads in alternating order, three samples per buffer size, identical SHA-256 hashes. 64 KiB samples: 1034, 901, 914 ms (median 914 ms); 1 MiB: 812, 777, 892 ms (median 812 ms). Median verification time decreased about 11%. These are warm-cache measurements on this machine, not a guarantee for other disks or Telegram transfer rates. Test data was deleted after measurement.

Next useful measurement: download the same attachment with Season Shelf and Telegram Desktop sequentially on the same connection; record account tier, file size, elapsed receive time, checking/transferring time, bandwidth cap, concurrency and destination drive. Repeat at least three times. A separate throughput result is needed before tuning request windows or claiming higher network MB/s.
