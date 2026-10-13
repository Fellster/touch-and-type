import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ResetPassword from "./ResetPassword";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), updateUser: vi.fn(), navigate: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mocks.getSession, updateUser: mocks.updateUser, signOut: vi.fn() } } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(cleanup);

it("hides the password form for a used link without a session and offers a new email", async () => {
  render(<ResetPassword />);
  fireEvent.click(await screen.findByRole("button", { name: "Request a new reset email" }));
  expect(screen.getByText("This reset link is invalid or expired. Request a new one.")).toBeInTheDocument();
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  expect(mocks.navigate).toHaveBeenCalledWith("/forgot-password");
  expect(mocks.updateUser).not.toHaveBeenCalled();
});

it("handles a session that expires while the password form is open", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "test" } } }, error: null });
  mocks.updateUser.mockResolvedValue({ error: { name: "AuthSessionMissingError" } });
  render(<ResetPassword />);
  fireEvent.change(await screen.findByLabelText("New password"), { target: { value: "samplepassword" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "samplepassword" } });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
  expect(await screen.findByText("This reset link is invalid or expired. Request a new one.")).toBeInTheDocument();
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});

it("does not describe a network failure as an expired link", async () => {
  mocks.getSession.mockRejectedValue(new Error("Network unavailable"));
  render(<ResetPassword />);
  expect(await screen.findByText("We couldn’t check your reset link. Please try again or request a new one.")).toBeInTheDocument();
});
