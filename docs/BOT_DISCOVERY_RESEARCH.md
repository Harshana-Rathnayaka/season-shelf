> Technical reference with dated findings. For current scope and acceptance, see [roadmap](ROADMAP.md) and [validation](VALIDATION.md). Later corrections in this document supersede earlier assumptions.

## Implementation update - 11 September 2026

Supported inline callback buttons now retain exact bytes and source peer/message ID and use messages.getBotCallbackAnswer after checking the current keyboard. Returned Telegram URLs and edits to the source keyboard are captured. Replies are re-fetched by ID after thread polling to retrieve current markup. Sole eligible results continue automatically through Start and join; multiple results require selection. Unsupported buttons are shown rather than silently discarded. This supersedes earlier statements that all callbacks are unsupported. Separate newly sent callback replies and subscription workflows remain incomplete; live MCF compatibility is unverified.

# Telegram series discovery feasibility

## Conclusion

The shared-chat workflow is technically achievable through Telegram's user-account API. It requires two separate conversations: a search posted in the correct group, followed by a private conversation with the responding bot. Sending the series name directly to the bot does not reproduce the reported workflow. Telegram provides APIs for sending to a chosen peer, reading message threads, starting a bot with a deep-link parameter, and joining a channel. API availability establishes feasibility; it does not establish that every MovieClubFamily response format is supported by the current app. [1–5]

The recommended approach is to retain discovery with explicit, visible steps. Keep the existing paste-message-link option as a fallback. Do not turn this into unattended repeated searching until the real group, reply linkage and result buttons have been verified on the account.

## The entry channel and the search group

The public MovieClubFamily landing page identifies a Waiting Area. Its public post preview directs readers through a separate invitation site to a Films Group and also references a Chat Group. This supports the interpretation that the public username is an entry point rather than necessarily the peer where searches are posted. The post preview is cached and is insufficient evidence of the account's current membership or the exact search-group ID. The invitation site is not needed when the account already belongs to the destination group. [6]

Telegram distinguishes broadcast channels from discussion groups. A channel may expose a linked discussion group in `channelFull.linked_chat_id`; channel comments are threads inside that group. A group linked from a post or invitation is not necessarily a Telegram-linked discussion group. Therefore, blindly assuming either “the channel itself” or “its linked discussion group” is insufficient. [7]

Resolve MovieClubFamily using the logged-in account and inspect its entity type. If it is a suitable group, show its title. If it is a broadcast channel, inspect its full information for an associated group. If no association exists, offer joined groups for explicit selection, ranking likely MovieClubFamily names first. Naming is a convenience, not proof of identity. Always show the final group before posting. `channels.getFullChannel` supplies the required channel information. [8]

## Correct interaction sequence

| Step | Required behaviour | Confidence and limit |
|---|---|---|
| Identify search chat | Resolve the entry peer or select the actual joined group | Supported; exact account-specific destination needs acceptance |
| Post series name | Send one message to that group as the logged-in user | Supported, subject to group permissions |
| Collect replies | Match the verified series bot and the submitted message's reply/thread ID | Supported when the bot uses real reply metadata |
| Choose series | Inspect the returned button or link; retain its exact target | URL and private-message links supported now |
| Start private bot | Use the selected deep-link payload, or plain `/start` if no payload exists | Supported; plain start cannot recreate a missing series identifier |
| Receive destination | Inspect the bot's next reply and display the channel | Depends on its result format |
| Join and scan | Join the selected accessible channel, then reuse the catalog scanner | Supported; approvals and expired invites can interrupt it |

The search message is visible to other group members. The destination title and this visibility belong next to the submit button, rather than being hidden in settings. Selecting a group, reading a message, or previewing a channel should not itself send a query or join anything.

## Reply correlation is essential

A busy group can contain many requests for the same title. Matching the words “Breaking Bad” or simply accepting the next bot message can attach someone else's result to the current search. Record the peer and returned request message ID, then require the responder's numeric identity and reply linkage. Telegram's reply header distinguishes the direct reply target from the root message of a thread. Display names are not identity checks. [9]

For supergroups, `messages.getReplies` can retrieve the submitted message's thread. The installed Teleproto implementation routes `getMessages(peer, {replyTo: requestId})` to that API. Re-read the thread to incorporate edits and multiple replies, then deduplicate by message ID. Basic groups can use bounded history reads with the same explicit reply filtering. If the bot posts as an anonymous channel identity or sends unthreaded results, the present implementation deliberately does not associate them by guessing. [2]

Telegram also offers pushed updates, including edited messages and mechanisms for recovering update gaps. A later version can subscribe before posting and reconcile the resulting thread after the send completes. This would reduce polling and improve late-result handling. The current bounded polling approach is simpler but can miss replies arriving after its collection window; cancellation stops waiting, not the already-posted query. [10]

## Links, Start and buttons are different operations

A link such as `t.me/c/1301811144/10288467` identifies a private message by chat and message ID. It does not encode a series-specific bot start parameter. The account must be able to access that message, and the app must inspect the message's actual entities and buttons. A browser's handling of the copied message URL does not prove what URL is attached to a button inside that message. [11]

Bot deep links commonly contain `?start=...`. Preserve that parameter exactly. `messages.startBot` accepts the bot, conversation peer and parameter; Telegram documents an error for an empty start parameter. Consequently, an explicit plain Start action should send `/start`, while a parameterized action should use `messages.startBot`. If no parameter exists, any remembered series context belongs to the bot; the app cannot infer it from a title or private message ID. [3,11]

An inline callback button contains opaque data rather than an ordinary URL. Telegram supports pressing it through `messages.getBotCallbackAnswer`, using the original peer, message ID and callback bytes. This makes callback-based pagination feasible, but a URL parser alone cannot implement it. The response can contain an alert or URL, and subsequent message edits must also be handled. Do not invent callback bytes from the displayed caption. [4]

Files attached to a bot message are another case: a text attachment may contain a destination link, or a video attachment may itself be the result. Reading only message text and URL buttons does not cover either case. These formats need separate bounded attachment handling and source identity tracking. They remain future work, not evidence that the entire workflow is impossible.

## Membership, permissions and waiting

Group posting depends on the account's permissions. Telegram can reject writes because of restrictions, closed topics, paid-message requirements or slow mode. The app should surface the server's response and avoid silently retrying the search as a new message. There is no single universal polling or posting rate that guarantees acceptance. [1,12]

Private invitations can expire, require approval, exceed membership limits or require a subscription. A successful join request is different from immediate access to files. Keep explicit channel selection, distinguish pending approval from a completed join, and leave payment or unrelated subscription tasks to Telegram. Discovering a required channel is not a reason to automatically join every advertised destination. [5]

## Implementation status and remaining work

The revised implementation separates search-group discovery from private bot actions. It previews the resolved group, falls back to selecting joined groups when the entry channel has no linked group, and requires a main-owned source token before accepting a query. Tokens expire and are consumed on submission. Queries go to the selected group; replies must come from the configured bot and link to the submitted request. Private Start and selected-channel join remain later actions.

The current version supports URL buttons, caption links, private message lookup, parameterized bot Start, plain `/start`, channel preview and selected joins. It does not support callback pagination, forum-topic selection, anonymous bot replies, unthreaded result matching, attachment-contained links or bot-delivered video cataloging. Group enumeration examines up to 1,000 recent dialogs; this is a practical limit rather than a complete account index. Collection uses a 30-second polling window and may finish after five quiet seconds once a supported link appears.

The next acceptance check should use one series request in the group displayed by the app. Confirm that the returned thread belongs to that request, that the result's Start parameter survives, and that the final channel is the intended series. Include a multi-result request and an edited reply. No success claim for the live MovieClubFamily chain should precede that check. If its results require callbacks, retain manual Telegram search plus pasted links while implementing callback support.

## Sources

Telegram documentation is continuously maintained; individual pages do not provide a reliable publication date. References were consulted on 11 September 2026. The public post preview in reference 6 is cached, so its invitation routing is a lead rather than a verified current account path.

1. Telegram, [messages.sendMessage](https://core.telegram.org/method/messages.sendMessage): peer-targeted sends and posting errors.
2. Telegram, [messages.getReplies](https://core.telegram.org/method/messages.getReplies): thread retrieval and pagination.
3. Telegram, [messages.startBot](https://core.telegram.org/method/messages.startBot): start parameters and empty-parameter errors.
4. Telegram, [messages.getBotCallbackAnswer](https://core.telegram.org/method/messages.getBotCallbackAnswer): callback-button interaction.
5. Telegram, [messages.importChatInvite](https://core.telegram.org/method/messages.importChatInvite): membership and approval outcomes.
6. MovieClubFamily, [public landing page](https://t.me/MovieClubFamily) and [public post preview](https://t.me/s/MovieClubFamily): Waiting Area and invitation routing.
7. Telegram, [Discussion groups](https://core.telegram.org/api/discussion): linked groups and channel comments.
8. Telegram, [channels.getFullChannel](https://core.telegram.org/method/channels.getFullChannel): full channel metadata.
9. Telegram, [messageReplyHeader](https://core.telegram.org/constructor/messageReplyHeader): direct and thread-root reply identity.
10. Telegram, [Working with Updates](https://core.telegram.org/api/updates): new/edited events and update continuity.
11. Telegram, [Deep links](https://core.telegram.org/api/links): private message URLs and bot Start URLs.
12. Telegram, [Error handling](https://core.telegram.org/api/errors): server-reported wait and failure conditions.
