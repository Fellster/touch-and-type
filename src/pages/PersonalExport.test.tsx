import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const state = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock("@/lib/exportPersonal", () => ({ exportPersonalCopy: state.copy }));
import PersonalExport from "./PersonalExport";
beforeEach(() => {
  state.copy.mockReset();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:backup"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("old app backup page", () => {
  it("downloads a validated copy and reports included and excluded counts", async () => {
    state.copy.mockResolvedValue({ text: "backup-json", counts: { customers: 4, todos: 6, media: 2 }, excludedCustomers: 1, excludedTodos: 2 });
    render(<MemoryRouter><PersonalExport /></MemoryRouter>);
    expect(screen.getByText(/Restoring replaces the Android notebook/)).toBeVisible();
    fireEvent.click(screen.getByLabelText("Include team customers where I am the recorded owner"));
    fireEvent.click(screen.getByRole("button", { name: "Download backup" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("4 customers, 6 to-dos, 2 pictures/drawings"));
    expect(state.copy).toHaveBeenCalledWith(true);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });
  it("does not download an incomplete backup and offers retry", async () => {
    state.copy.mockRejectedValue(new Error("A photo could not be downloaded. No incomplete backup was downloaded."));
    render(<MemoryRouter><PersonalExport /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Download backup" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No incomplete backup"));
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Download backup" })).toBeEnabled();
  });
});
