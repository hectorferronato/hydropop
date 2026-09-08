# Private Community

[Documentation hub](README.md) · [Frontend](frontend.md) · [Security](security.md)

Community is implemented, not a placeholder. It is a consent-based directory for
signed-in pilot members, not a public social network.

## Member journey

1. Visit `/community` with an allowed account.
2. If not joined, choose a username and explicitly confirm limited-profile sharing.
3. Browse the directory and `/u/[username]` member summaries.
4. Change username or visibility at `/settings/community`.

Hiding removes the member from the directory and makes their profile unavailable
to other members. Their username remains reserved. Shared URLs do not bypass
login or Community access checks. Metadata is `noindex`, but authorization—not
robots metadata—is the privacy boundary.

## Shared data

The [summary contract](../lib/contracts/community.ts) exposes display name,
username, join time, current streak, today's intake/goal, seven-day average and
eligible/goal-day counts, with optional limited daily/completion details. It does
not expose email, internal user IDs, raw events, bottle identifiers, device
credentials or NFC data. The current directory schema is bounded to 50 members.

## Implementation and maintenance

- [Community page/actions](<../app/(private)/community>) owns join/consent and directory UI.
- [Community adapter](../lib/infrastructure/supabase/community.ts) validates RPC results.
- [Username domain](../lib/domain/community/username.ts) normalizes/validates names and reservations.
- [Community migration](../supabase/migrations/20260730120000_add_private_community_pilot.sql) owns RLS, reservations and limited aggregates.

Community aggregates reconstruct effective hydration and date-effective goals.
When changing hydration semantics, test these SQL summaries as well as Today and
Trends. Hydration revalidation includes the directory and member routes. When
changing visibility or a username, revalidate both the previous and current
member paths. Keep consent separate from notification enablement: joining
Community does not authorize push notifications.
