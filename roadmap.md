# Roadmap

## Done
- [x] Customer sharing — database/security layer (customer_shares table, view/edit helpers, RLS on customers/photos/drawings, storage policies, FKs with cascade, signed-out access removed)
- [x] Two-account verification of sharing rules
- [x] delete-customer server function that removes stored photo/drawing files with the customer

- [x] Share UI on the customer page (invite by email, view/edit, revoke) via manage-share function
- [x] Customer deletion wired to delete-customer (removes stored files)
- [x] Shared customers shown in the customer list with a "Shared with me" badge

## Later
- [ ] Designers page roll-up for shared customers
