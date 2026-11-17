import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ exportFile: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "android" },
  registerPlugin: () => mocks,
}));
import { downloadBackup } from "./storage";
beforeEach(() => mocks.exportFile.mockReset());
describe("native backup confirmation", () => {
  it.each([
    undefined,
    { bytes: 0, verified: true },
    { bytes: 100, verified: false },
  ])("rejects unverified export result %j", async (result) => {
    mocks.exportFile.mockResolvedValue(result);
    await expect(downloadBackup('{"format":"noted-personal"}')).rejects.toThrow(
      "not verified",
    );
  });
  it("accepts only a nonempty verified result and forwards the chosen location", async () => {
    mocks.exportFile.mockResolvedValue({ bytes: 100, verified: true });
    await downloadBackup('{"format":"noted-personal"}', "drive");
    expect(mocks.exportFile).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "drive",
        text: '{"format":"noted-personal"}',
      }),
    );
  });
});
