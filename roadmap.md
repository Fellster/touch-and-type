# Roadmap

## Done
- [x] Customer sharing — database/security layer (customer_shares table, view/edit helpers, RLS on customers/photos/drawings, storage policies, FKs with cascade, signed-out access removed)
- [x] Two-account verification of sharing rules
- [x] delete-customer server function that removes stored photo/drawing files with the customer

## Later
- [ ] Wire customer deletion on the customer page to the delete-customer function (file cleanup)
- [ ] Share UI on customer page (invite by email, list recipients, revoke)
- [ ] Shared customers in the customer list + designers roll-up
