# Audit: customer ownership and sharing in Noted

No changes made yet. This is what I found and what it would take to support private-by-default customers with per-customer sharing.

## What controls ownership today

Every record carries a `user_id` column and each table's access rules simply say "the signed-in user must equal `user_id`":

- `customers`, `custom_fields`, `drawings`, `photos` — four rules each (view / add / edit / delete), all `auth.uid() = user_id`
- `todos` — one rule covering everything, same check
- Photo and drawing files live in two private buckets (`photos`, `drawings`) with paths shaped `<user id>/<customer id>/<timestamp>.<ext>`; file rules allow access only when the first folder of the path equals the signed-in user's id
- The app never filters by user in its queries — it relies entirely on the database rules, and the app-side MCP tools pass the signed-in user's token, so they inherit the same rules

## Is data actually protected?

Yes, for the current private-only model. Each user can only see their own customers, notes, images, fields and tasks, at the database level, and files are equally locked down. There is no sharing path at all — a second user simply sees nothing of the first user's data.

Issues worth fixing regardless:

1. The rules are attached to the broad `public` role instead of `authenticated`, and the signed-out role still holds table grants. Nothing leaks today (the checks fail for signed-out visitors), but it's an unnecessarily wide surface.
2. `customers.user_id`, `photos.user_id`, `drawings.user_id`, `custom_fields.user_id` have no link to the accounts table (unlike `todos`), so deleting a user leaves orphaned rows.
3. Ownership on images is encoded in the file path. Once files are shared, path-based checks can no longer express "shared with me" — this is the main blocker for requirement 8.
4. Deleting a customer removes its database rows, but the underlying image files in storage are not removed.

## What is missing for sharing

There is no share table, no membership concept, and no helper the rules can call. Everything needed for sharing has to be added.

## Proposed model

- New table `customer_shares`: which customer, which recipient account, permission level (`view` or `edit`), who granted it, timestamps. One row per customer per recipient.
- New helper functions (run with elevated rights so the rules don't loop on themselves):
  - `can_view_customer(customer_id)` — true if owner or has any share
  - `can_edit_customer(customer_id)` — true if owner or has an `edit` share
- Rewrite access rules on `customers`, `photos`, `drawings` to use those helpers instead of raw `user_id`. Ownership stays with `user_id`; only the owner can delete a customer or manage its shares.
- Recipients can never list or reach the owner's other customers — access is granted one customer at a time, and `custom_fields` and `todos` stay strictly private to their owner.
- File access moves from "path starts with my id" to "the path's second folder is a customer I'm allowed to see", so images automatically follow the customer's sharing state. Owner keeps exclusive delete rights.
- Revoking is deleting the share row; access disappears immediately for both data and images.
- A small lookup so a customer can be shared by typing the recipient's email — implemented as a restricted server-side function that returns only an account id, never a list of users.

## Files and migrations that would change

Database migrations (new, in order):
1. Create `customer_shares` with grants, row security, and rules limiting management to the customer's owner.
2. Create the `can_view_customer` / `can_edit_customer` helpers.
3. Replace the access rules on `customers`, `photos`, `drawings` with helper-based ones; scope all rules to signed-in users only.
4. Replace the six file-access rules on the two buckets with customer-based ones.
5. Hardening: remove signed-out grants, scope `custom_fields` and `todos` rules to signed-in users, add account links with cascade delete.

Application files (after the database work):
- `src/pages/CustomerDetail.tsx` — show shared state, add a Share panel (invite by email, list recipients, revoke), disable editing for view-only recipients
- `src/pages/Customers.tsx` — include shared customers in the list with a "shared with me" marker; keep new customers owned by the creator
- `src/pages/Designers.tsx` — decide whether shared customers appear in the designer roll-up (default: yes, matching the list)
- `src/lib/mcp/tools/get-customer.ts`, `search-customers.ts`, `append-customer-note.ts`, `create-customer.ts` — no logic change required, but each needs re-verification against the new rules
- `src/integrations/supabase/types.ts` — regenerated automatically

## Must fix before launch

- Storage rules must move off path-based ownership before any sharing ships, otherwise shared users see the record but broken images.
- Tighten rules to signed-in users only and drop signed-out grants.
- Clean up image files when a customer is deleted.
- Add account links so deleted accounts don't leave orphaned customer data.

## Open choices

- Should a shared recipient be able to edit, or view only? The plan supports both via the permission level; default proposed is `edit`.
- Should shared customers be included on the Designers page? Proposed: yes.
