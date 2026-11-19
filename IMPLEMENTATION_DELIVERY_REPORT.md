# VORTEX implementation delivery report

**Delivery date:** 2026-11-19  
**Primary project:** VORTEX  
**Reference project:** Reelo  
**Overall status:** A source-level implementation and audit-repair pass has been prepared. It is **not production-certified**; SQL execution, full dependency validation, browser E2E, and live Supabase checks remain outstanding.


## 0. Audit-repair pass (2026-11-19)

The following fixes were applied to the working copy after the runtime audit supplied with this task:

- Moved the `conversations.created_by` column addition to the start of migration 5 so helper functions can compile on a fresh database.
- Removed the stale `handle_follow_counts()` redefinition from migration 8 so it no longer overwrites the accepted/pending-aware function from migration 5. Migration 12 also re-establishes the accepted/pending-aware counter trigger for databases where migration 8 was already applied.
- Removed explicit `BEGIN`/`COMMIT` wrappers from migrations 9–11 so Supabase's migration transaction owns the boundary.
- Fixed nullable Story captions in `SupabaseStoriesService` and batched signed-URL creation for story/post result sets.
- Added auth-state subscription and deferred profile hydration, safer pending-email storage, and a stable initial-loading state in `AuthContext`.
- Replaced hard-coded demo credentials in the sign-in form, improved error distinction, and improved duplicate-email/username handling.
- Added safe missing-env handling and an application error boundary to avoid a production white screen.
- Added storage upload-path ownership checks and aligned client post-media/attachment size limits with the 10 MiB bucket limit.
- Changed feed Realtime behavior to a new-post notice rather than a full refresh for each interaction; added the server-side following-feed RPC and atomic post like/repost/bookmark RPC client calls.
- Added migration 12 for case-insensitive usernames, managed counters, content/attachment limits, media ownership checks, suspended-account interaction restrictions, initial per-action write limits, trigram/feed indexes, time-decayed For You ranking, and database RPCs.
- Added migration 13 for a ten-image per-post limit, guarded media updates, tag-length validation, a community feed index, and bounded For You candidate ranking. The post modal now uploads to private Storage rather than accepting arbitrary image URLs.
- Added Cloudflare Pages `_redirects`/`_headers` and Vercel SPA/security-header configuration. CSP has not yet been tested against a deployed build and any third-party integrations.

Migration 12 deliberately aborts if legacy case-insensitive username collisions already exist; resolve those account-name collisions before retrying. It does not silently rename users.

## 1. Changes implemented

### Product scope and interface

- VORTEX remains the React 18 / TypeScript / Vite application. No Reelo UI, legacy PHP, or replacement framework was introduced.
- Removed the paid Pro upgrade card, the fake upgrade-confirmation modal, and placeholder activity cards from the desktop navigation.
- Removed the Reels navigation entries and route, Reels page, Reels service contracts/implementations, and the Reels media grid component path.
- Removed `videoUrl` from the post domain contract and limited Story domain media to `image`.
- The visible VORTEX layout, color palette, logo, typography, and existing component design were not intentionally redesigned.
- Removed hard-coded default unread badges from the desktop sidebar; absent real counts now default to zero.

### Image-only content and Storage

- Post creation and message attachments accept JPG/JPEG, PNG, WebP, and GIF only.
- Story creation now uploads to a private `story_media` bucket, saves the object path (not a signed URL), and signs the path when Stories are read. Story object reads re-check active Story visibility and the existing privacy/block helper.
- Story queries filter for active image records. Story RLS continues to call the existing privacy/block-aware `can_view_story` helper.
- `post_media`, `attachments`, and `story_media` are configured as private buckets. Storage read policies restrict post images to visible image media, message images to accessible conversations, and Story images to active Stories visible to the viewer.
- The shared Storage helper now enforces per-bucket size ceilings and checks the file's magic signature as client-side defense in depth.
- Post mapping explicitly filters legacy `post_media` rows to `media_type = 'image'`, so old video rows are not rendered as broken image placeholders.
- Migration 9 removes active Reels policies, disables old Reel tables through revoked access and legacy table names, preserves their historical rows, adds image-only constraints for new/updated media rows, and restricts the configured MIME allowlists.

### Messaging and Realtime

- Replaced the previous nested all-messages conversation lookup with `vortex_get_conversation_summaries()`, returning the latest message, unread count, participant/group metadata, and owner id without downloading every message in every conversation.
- Direct conversation creation calls `vortex_get_or_create_direct_conversation()`; a transaction-scoped advisory lock serializes requests for the same user pair to prevent concurrent duplicate DMs.
- Message history fetches the latest 100 messages in descending database order and reverses them for chronological display. It includes read receipts.
- Read-state updates use `vortex_mark_conversation_read()` rather than a direct client update. The RPC writes the current user's read receipts for newly-read incoming messages.
- Added Supabase Realtime message-insert subscription for the active conversation, notification subscription for the current user's notification rows, and a feed subscription for post/media/like/comment/repost/follow changes. Feed updates are debounced before refreshing the current feed. The UI unsubscribes when the relevant view changes/unmounts.
- Kept a low-frequency message refresh as a fallback in case the Realtime socket is unavailable.
- Added message image attachment upload and display, with private object paths and signed URLs.
- Added database RPCs and UI for creating groups, viewing members, renaming groups, adding/removing members, and leaving a group. Database functions enforce administrator/owner permissions, membership, blocking, and a maximum group size.
- The prior fake call controls, demo/encryption claims, and fake “sent attachment” behavior were removed from the messaging page.

### Database migrations

Migrations 5 and 8 were corrected for clean-install compilation and follow-counter preservation. Migrations 9–11 had their explicit transaction wrappers removed. Migrations 12 and 13 were added as additive hardening migrations:

- `20261118000009_image_only_decommission_reels.sql`
- `20261118000010_messaging_direct_groups_realtime.sql`
- `20261118000011_private_image_story_storage.sql`
- `20261118000012_vortex_integrity_performance_hardening.sql`

The Reelo project was used as a source of behavioral patterns for direct-message uniqueness, group membership roles, message read state, and Realtime updates. Reelo's legacy SQL was not copied or run directly against VORTEX.

## 2. Not completed / must not be assumed complete

The full master prompt describes a much larger product than can be honestly certified from source edits alone. The following requirements remain incomplete or require more engineering:

1. **Database validation:** migrations 1–13 have not been executed against Supabase/PostgreSQL in this environment. Migrations 12–13 and both pgTAP suites require a clean local Supabase reset and full test run.
2. **Full group lifecycle:** there is no ownership-transfer or owner-close-group UI/RPC. A group creator is prevented from leaving until that lifecycle exists. Join requests/invitations are not implemented.
3. **Message operations:** edit/delete message actions are not implemented. The UI loads only the latest 100 messages; cursor pagination/search inside a conversation remains outstanding.
4. **Realtime breadth:** messages and notifications have client subscriptions; the feed now listens for new post inserts and shows a manual refresh notice. Group membership and community activity do not yet have corresponding client subscriptions. Typing indicators and online/offline Presence are not implemented.
5. **Relationships:** current Follow functionality remains. A complete two-sided friend-request/accept/reject/remove workflow and friend suggestions are not implemented as a separate coherent relationship model.
6. **Search:** existing search is not a complete global full-text Arabic/English search engine with GIN/trigram indexes, ranking, and cursor pagination. Debounced user search is used in the group-member picker only.
7. **Posts:** current feed reads are still bounded queries; complete cursor-based infinite scroll, personalized ranking beyond the new time-decayed For You score, post pinning/share UX, and optimized incremental Realtime updates are outstanding.
8. **Image security:** browser-side MIME/signature checks and Storage MIME allowlists are not server-side image decoding. A malicious client can bypass frontend checks. A trusted server-side image decoder/re-encoder, EXIF stripping, and optional malware scanning are still required before claiming robust file-content validation.
9. **Moderation/security:** migrations 12–13 add database-side write limits and post media bounds and static-host security headers, but these require live verification and tuning. Complete report/block UX, spam analytics, audit visibility, abuse monitoring, account export/deletion, and deployed CSP compatibility tests are still incomplete. RLS remains the authoritative boundary but must be tested after applying migrations.
10. **Supabase types:** the project still uses loosely typed PostgREST row mappers in other existing service files; generated database types should be generated from the deployed schema and adopted throughout.
11. **Media cleanup:** expired/deleted Story objects are not automatically garbage-collected from Storage. Add a trusted scheduled cleanup process only after safely reconciling referenced object paths.
12. **Existing external URLs:** some avatar/cover/community profile fields can still contain third-party image URLs. Supabase Storage RLS cannot protect external hosts.
13. **Production UX:** translation keys were extended for group controls, but a complete localization and accessibility review of every new/existing label is still needed.

## 3. Validation performed in this delivery

| Check | Result |
|---|---|
| TypeScript/TSX syntax parsing | **Passed** — 85 `.ts` / `.tsx` source files parsed with zero syntax diagnostics using the globally installed TypeScript parser |
| English/Arabic translation key parity | **Passed** — 267 keys in each dictionary; no missing keys in either language |
| Reels/video UI source scan | **No active references found** in `src` for video tags, video URLs, Reels pages/services, or video media filters |
| Paid-plan UI source scan | **No paid membership/upgrade/payment UI references found** in `src`; the remaining word “premium” appears only in a CSS aesthetic comment |
| `npm ci` | **Not completed** — the dependency installation command timed out; the `node_modules` directory is incomplete |
| `npm run typecheck` | **Blocked** — TypeScript reports missing implicit type definition packages (`react`, `react-dom`, `node`, `aria-query`, Babel/Chai related types, etc.) due to the incomplete install |
| `npm test` | **Not run successfully** — `vitest: not found` because dependencies are incomplete |
| `npm run build` | **Blocked at typecheck** with the same missing type-definition errors; Vite did not start |
| SQL migrations / pgTAP / RLS tests | **Not run** — no PostgreSQL, Supabase CLI, or Docker-backed database runtime was available; migrations 12–13 and their pgTAP structural test are source-only |
| Live Auth / Storage / Realtime | **Not tested** — requires project URL/key and a configured Supabase project with all migrations applied |

A zero-syntax-error parse is not a substitute for a successful TypeScript typecheck or production build. No claim is made that the new SQL compiles or that live Supabase operations succeed.

## 4. Required next steps before deployment

1. Install dependencies successfully with `npm ci` on a machine with registry access.
2. Run `npm run typecheck`, `npm test`, and `npm run build`; resolve every error without disabling checks.
3. Apply migrations to a clean local Supabase database, run `supabase test db`, and manually test two independent authenticated accounts.
4. Verify message, group, notification, and private-image Storage policies using non-admin sessions, including blocked/private-account cases.
5. Complete server-side image-content validation/re-encoding, Arabic-aware search normalization, cursor pagination, message edit/delete, typing/presence, remaining Realtime subscriptions, moderation UX, and missing end-to-end tests.
6. Verify the deployed Supabase project has the `messages` and `notifications` tables enabled in Realtime and the private `story_media` bucket/policies created by migration 11.
7. Apply migrations 12 and 13 only after confirming the previous migration history and resolving any pre-existing case-insensitive username collisions; test all new triggers/RPCs with two non-admin accounts.
8. Install the full dependency tree and verify `npm audit`, `npm run typecheck`, `npm test`, and `npm run build`.
9. Upgrade React Router to the patched line for the current backslash-open-redirect advisory and run route/navigation regression tests before production.

**Deployment decision: do not publish this archive as a production-ready social network until the checks and outstanding work above are complete.**
