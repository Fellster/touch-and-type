import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CustomerDetail from "./CustomerDetail";

const mocks = vi.hoisted(() => ({ viewer: false }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useParams: () => ({ id: "customer" }), useSearchParams: () => [new URLSearchParams(), vi.fn()] }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "self" } }) }));
vi.mock("@/hooks/useSettings", () => ({ useLabels: () => ({ shoe_size: "Size", width: "Width", designers: "Designers", looking_for: "Wants" }) }));
vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/VoiceCapture", () => ({ default: () => null }));
vi.mock("@/components/DrawingCanvas", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: async () => ({ data: { shares: [] } }) },
  storage: { from: () => ({ createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://example.com/${path}` } }) }) },
  from: (table: string) => {
    const rows = table === "custom_fields" ? [{ id: "field", key: "budget", label: "Budget", field_type: "number", sort_order: 0 }]
      : table === "customer_personal_details" ? [{ user_id: "self", notes: "Prefers blue", wants: ["Boots"], updated_at: "2026-10-16" }]
      : table === "drawings" ? [{ id: "drawing", user_id: "self", storage_path: "sketch.png", ocr_text: "Sketch notes" }]
      : table === "photos" ? [{ id: "photo", user_id: "self", storage_path: "photo.png" }] : [];
    const chain = {
      select: () => chain, eq: () => chain,
      order: async () => ({ data: rows }),
      single: async () => ({ data: { id: "customer", user_id: mocks.viewer ? "other" : "self", team_id: null, name: "Amy Fell", phone: "555-123-4567", email: "amy@example.com", shoe_size: 8, width: "Medium", designers: ["Mephisto"], looking_for: ["Sandals"], typed_notes: "Call next week", custom_data: { budget: 0 } } }),
      maybeSingle: async () => ({ data: { permission: "view" } }),
    };
    return chain;
  },
} }));
beforeEach(() => { mocks.viewer = false; vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("opens as a readable customer page with contact information, saved content, and no editing fields", async () => {
  render(<CustomerDetail />);
  expect(await screen.findByRole("heading", { name: "Amy Fell" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "555-123-4567" })).toHaveAttribute("href", "tel:5551234567");
  expect(screen.getByRole("link", { name: "amy@example.com" })).toHaveAttribute("href", "mailto:amy@example.com");
  expect(await screen.findByText("Prefers blue")).toBeInTheDocument();
  expect(screen.getByText("Call next week")).toBeInTheDocument();
  expect(screen.getByText("Boots")).toBeInTheDocument();
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(await screen.findByRole("img", { name: "Drawing for Amy Fell" })).toBeInTheDocument();
  expect(await screen.findByRole("img", { name: "Photo for Amy Fell" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete this customer" })).not.toBeInTheDocument();
});

it("uses the pencil to edit and restores saved details when unsaved changes are discarded", async () => {
  render(<CustomerDetail />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit or add customer information" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Customer name" }), { target: { value: "Unsaved name" } });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("textbox", { name: "Customer name" })).toHaveValue("Unsaved name");
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("heading", { name: "Amy Fell" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("keeps view-only shared fields protected while allowing the member's own additions", async () => {
  mocks.viewer = true;
  render(<CustomerDetail />);
  await screen.findByText("Prefers blue");
  fireEvent.click(screen.getByRole("button", { name: "Edit or add customer information" }));
  expect(screen.getByRole("textbox", { name: "Customer name" })).toHaveAttribute("readonly");
  expect(screen.getByLabelText("My Notes")).not.toHaveAttribute("readonly");
  expect(screen.getByRole("button", { name: "Add new drawing" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add photo" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument();
});
