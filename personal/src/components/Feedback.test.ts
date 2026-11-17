// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Feedback, { type FeedbackMessage } from "./Feedback";
const info: FeedbackMessage = { id: "1", text: "Calendar opened", tone: "info" };
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); document.querySelectorAll("dialog").forEach(d => d.remove()); vi.useRealTimers(); });
describe("quiet bottom messages", () => {
  it("automatically dismisses a short confirmation", () => {
    const dismiss = vi.fn();
    render(createElement(Feedback, { message: info, dismiss }));
    expect(screen.getByRole("status").textContent).toBe("Calendar opened");
    act(() => vi.advanceTimersByTime(3999)); expect(dismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1)); expect(dismiss).toHaveBeenCalledTimes(1);
  });
  it("keeps errors available until explicitly dismissed", () => {
    const dismiss = vi.fn();
    render(createElement(Feedback, { message: { ...info, tone: "error", text: "Could not save" }, dismiss }));
    act(() => vi.advanceTimersByTime(60000)); expect(dismiss).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Could not save");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
  it("restarts the timer for a repeated confirmation and pauses while focused", () => {
    const dismiss = vi.fn();
    const view = render(createElement(Feedback, { message: info, dismiss }));
    act(() => vi.advanceTimersByTime(3000));
    view.rerender(createElement(Feedback, { message: { ...info, id: "2" }, dismiss }));
    act(() => vi.advanceTimersByTime(2000)); expect(dismiss).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByRole("button", { name: "Dismiss message" }));
    act(() => vi.advanceTimersByTime(10000)); expect(dismiss).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole("button", { name: "Dismiss message" }));
    act(() => vi.advanceTimersByTime(4000)); expect(dismiss).toHaveBeenCalledTimes(1);
  });
  it("moves into the active dialog so errors remain visible and dismissible", async () => {
    render(createElement(Feedback, { message: { ...info, tone: "error" }, dismiss: vi.fn() }));
    const dialog = document.createElement("dialog");
    await act(async () => { dialog.setAttribute("open", ""); document.body.append(dialog); });
    expect(dialog.contains(screen.getByRole("alert"))).toBe(true);
    await act(async () => { dialog.removeAttribute("open"); });
    expect(dialog.contains(screen.getByRole("alert"))).toBe(false);
  });
});
