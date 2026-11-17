import "fake-indexeddb/auto";
import { describe, it, expect, vi } from "vitest";
import { emptyNotebook, validateNotebook, deleteCustomer } from "./model";
import { encodeBackup, decodeBackup } from "./backup";
import { loadNotebook, saveNotebook } from "./storage";
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => "web" },
  registerPlugin: () => ({}),
}));
function sample() {
  const n = emptyNotebook();
  n.customers.push({
    id: "c1",
    name: "Maria",
    phone: "847-555-0104",
    email: "",
    designers: ["Chanel"],
    shoeSize: "8",
    width: "Wide",
    wants: ["Loafers"],
    notes: "Black",
    personalNotes: "Call Friday",
    custom: { sizeNote: "Left foot larger" },
    updatedAt: new Date().toISOString(),
  });
  n.todos.push({
    id: "t1",
    customerId: "c1",
    title: "Call Maria",
    due: "",
    done: false,
    position: 0,
  });
  n.media.push({
    id: "p1",
    customerId: "c1",
    kind: "photo",
    name: "shoe.png",
    data: "data:image/png;base64,aGVsbG8=",
    text: "",
  });
  return n;
}
describe("complete notebook backup", () => {
  it("round trips customer records, linked tasks, custom data, settings, and media bytes", async () => {
    const n = sample();
    n.settings.font = "kalam";
    const restored = await decodeBackup(await encodeBackup(n));
    expect(restored).toEqual(n);
  });
  it("rejects a changed file even when it remains valid JSON", async () => {
    const backup = JSON.parse(await encodeBackup(sample()));
    backup.payload = backup.payload.replace("Maria", "Other");
    await expect(decodeBackup(JSON.stringify(backup))).rejects.toThrow(
      "damaged",
    );
  });
  it("rejects unsupported backup versions", async () => {
    const backup = JSON.parse(await encodeBackup(sample()));
    backup.version = 99;
    await expect(decodeBackup(JSON.stringify(backup))).rejects.toThrow(
      "supported",
    );
  });
  it("rejects duplicate IDs and orphaned items before saving", () => {
    const n = sample();
    n.customers.push(n.customers[0]);
    expect(() => validateNotebook(n)).toThrow();
    n.customers = [];
    expect(() => validateNotebook(n)).toThrow();
  });
  it("rejects executable media URLs", () => {
    const n = sample();
    n.media[0].data = "data:image/svg+xml;base64,PHN2Zz4=";
    expect(() => validateNotebook(n)).toThrow();
  });
  it("deletes a customer and their attachments/tasks together", () => {
    const n = deleteCustomer(sample(), "c1");
    expect(n.customers).toHaveLength(0);
    expect(n.todos).toHaveLength(0);
    expect(n.media).toHaveLength(0);
  });
});
describe("durable, atomic local writes", () => {
  it("survives a reload and rejects stale writers and corrupt restore without losing records", async () => {
    const initial = await loadNotebook();
    const n = sample();
    const revision = await saveNotebook(n, initial.revision);
    expect(await loadNotebook()).toEqual({ revision, notebook: n });
    await expect(
      saveNotebook(emptyNotebook(), initial.revision),
    ).rejects.toThrow("Another copy");
    expect((await loadNotebook()).notebook).toEqual(n);
    const bad = sample();
    bad.todos[0].customerId = "missing";
    await expect(saveNotebook(bad, revision)).rejects.toThrow();
    expect((await loadNotebook()).notebook).toEqual(n);
    const restored = await decodeBackup(await encodeBackup(n));
    await saveNotebook(emptyNotebook(), revision);
    const next = await loadNotebook();
    await saveNotebook(restored, next.revision);
    expect((await loadNotebook()).notebook).toEqual(n);
  });
});
