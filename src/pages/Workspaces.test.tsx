import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Workspaces from "./Workspaces";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), eq: vi.fn(), order: vi.fn(), role: "member" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "self" } }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useSearchParams: () => [new URLSearchParams()] }));
vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: mocks.eq }) }), functions: { invoke: mocks.invoke },
} }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "member";
  mocks.eq.mockReturnValue({ order: mocks.order });
  mocks.order.mockImplementation(async () => ({ data: [{ team_id: "team", role: mocks.role, teams: { id: "team", name: "Shoes", created_by: "self" } }], error: null }));
  mocks.invoke.mockImplementation(async (_name, { body }) => body.action === "list_members"
    ? { data: { members: [{ user_id: "self", name: "Keith", email: "keith@example.com", role: "admin" }, { user_id: "other", name: "Amy", email: "amy@example.com", role: "member" }] }, error: null }
    : { data: { ok: true }, error: null });
});
afterEach(cleanup);

describe("team roster", () => {
  it("shows the full roster to ordinary members without administrator controls", async () => {
    render(<Workspaces />);
    expect(await screen.findByText("Amy")).toBeInTheDocument();
    expect(screen.getByText("Keith")).toBeInTheDocument();
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "self");
    expect(screen.getByRole("button", { name: "Edit name for Keith" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit name for Amy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove Amy/ })).not.toBeInTheDocument();
  });

  it("lets an administrator save a team-specific name, including their own", async () => {
    mocks.role = "admin";
    render(<Workspaces />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit name for Amy" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Member name" }), { target: { value: "Amy Fell" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("team-invitations", { body: { action: "rename_member", team_id: "team", user_id: "other", name: "Amy Fell" } }));
    expect(screen.getByRole("button", { name: "Edit name for Keith" })).toBeInTheDocument();
  });

  it("shows a roster failure instead of silently showing an empty list", async () => {
    mocks.invoke.mockResolvedValue({ data: { error: "Could not load members." }, error: null });
    render(<Workspaces />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load members.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
