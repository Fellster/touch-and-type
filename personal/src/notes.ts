import type { Customer } from "./model";
// Keep existing private notes available within the single customer-notes section.
export const customerNotes = (c: Customer) =>
  [c.notes, c.personalNotes].filter(Boolean).join("\n\n");
