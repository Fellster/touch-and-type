
# Women's Footwear Customer Notes

A private customer-tracking app tailored to women's footwear sales. Each customer gets a rich note page with typed text, drawings, and photos, plus structured fields you can sort and filter by — and you can add your own custom fields any time.

## Access

- Single login (email + password) protects all data
- Sign-up disabled after your account is created so no one else can register
- Auto-confirm email on for fast first login

## Customer list (home screen)

- **Search bar**: matches across name, phone, notes text, "looking for", custom fields, and OCR'd handwriting
- **Sort dropdown**: A–Z / Z–A, Designer, Shoe size, Looking for, Recently updated, plus any custom field you've added
- **Filter chips**: quick filter by designer, size range, "looking for", or any custom field
- "+ New customer" button

## Customer page

**Built-in fields**
- Name, phone, email
- Preferred designer(s) — multi-tag
- Shoe size (US, half-sizes)
- Width (Narrow / Medium / Wide)
- Looking for — multi-tag (e.g. "black pump", "wedding sandal 8")

**Custom fields (you control)**
- A "Manage fields" screen lets you add new fields any time
- Each custom field has: name, type (text, number, tag list, date, yes/no), and a "sortable / searchable" toggle
- New fields appear on every customer page automatically and become available in the sort & filter menus
- Fields can be reordered, renamed, or hidden

**Free-form note area** with three input modes:
1. **Type** — rich text notes
2. **Draw** — finger/stylus canvas (pen color, size, eraser, undo, clear)
3. **Photos** — upload from camera or library, multiple per customer, tap to enlarge

**Handwriting → text (AI)**
- "Convert handwriting" button on any drawing
- Sends the drawing to Lovable AI and appends the transcribed text under the drawing
- Transcribed text is indexed for search

All edits autosave.

## Visual direction

Warm boutique aesthetic — cream background (#faf8f5), soft sand surfaces, muted taupe accents, serif display headings + clean sans body. Generous whitespace, rounded cards, subtle shadows. Feels like a personal atelier ledger, not a CRM.

## Layout

```text
┌─────────────────────────────┐
│ Customers          [+ New]  │
│ [search……………………………]        │
│ Sort: A–Z ▾   Filter ▾      │
├─────────────────────────────┤
│ ▢ Anna Reed                 │
│   Manolo · 7.5              │
│   Looking for: black pump   │
│ ▢ Beth Carrow               │
│   Aquazzura · 8             │
│ …                           │
└─────────────────────────────┘
       Settings → Manage fields
```

## Technical notes

- **Auth**: Lovable Cloud, single account, signups disabled after first user
- **Tables**:
  - `customers` — built-in columns + a `custom_data jsonb` column for user-defined fields
  - `custom_fields` — definitions (name, type, sortable, order)
  - `drawings` — image in Storage + `ocr_text`
  - `photos` — image in Storage
  - All RLS-locked to the owner
- **Search**: Postgres `ilike` across built-in text columns, `ocr_text`, and stringified `custom_data`
- **Sorting on custom fields**: order by `custom_data->>'field_key'` with type cast
- **OCR**: edge function calls Lovable AI (`google/gemini-3-flash-preview`) to transcribe handwriting verbatim
- **Drawing canvas**: HTML5 canvas with pointer events, mobile-optimized

## Out of scope (can add later)

- Multi-staff accounts and sharing
- Purchase history / order tracking
- Appointment scheduling
- CSV export / import
