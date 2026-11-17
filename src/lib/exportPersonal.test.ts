import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { exportPersonalCopy } from "./exportPersonal";
import { decodeBackup } from "./personalBackup";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  failMedia: false,
  calls: [] as string[],
  failTable: "",
  signedIn: true,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: state.signedIn ? { id: "owner" } : null }, error: null }),
    },
    from: (table: string) => {
      state.calls.push(table);
      return {
        select: () => ({
          eq: (column: string, id: string) => {
            expect(column).toBe("user_id");
            expect(id).toBe("owner");
            return {
              order: () => ({
                range: async (from: number, to: number) => ({
                  data: (state.tables[table] ?? []).slice(from, to + 1),
                  error: state.failTable === table ? { message: "unavailable" } : null,
                }),
              }),
            };
          },
        }),
      };
    },
    storage: {
      from: () => ({
        download: async () =>
          state.failMedia
            ? { data: null, error: { message: "not found" } }
            : {
                data: new Blob(["image-bytes"], { type: "image/png" }),
                error: null,
              },
      }),
    },
  },
}));
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  state.failMedia = false;
  state.calls = [];
  state.failTable = "";
  state.signedIn = true;
  localStorage.clear();
  state.tables = {
    customers: [
      {
        id: "personal",
        name: "Maria",
        user_id: "owner",
        team_id: null,
        updated_at: new Date().toISOString(),
        designers: ["Chanel"],
        custom_data: { heel: "low" },
      },
      {
        id: "team",
        name: "Team owned",
        team_id: "t",
        updated_at: new Date().toISOString(),
      },
    ],
    todos: [
      { id: "task", title: "Call Maria", customer_id: "personal", position: 0 },
      { id: "team-task", title: "Team call", customer_id: "team", position: 1 },
    ],
    photos: [
      { id: "pic", customer_id: "personal", storage_path: "owner/photo.png" },
    ],
    drawings: [],
    custom_fields: [],
    customer_personal_details: [
      { customer_id: "personal", notes: "Private note", wants: ["Wide"] },
    ],
  };
});
afterEach(() => vi.unstubAllGlobals());
describe("read-only personal migration", () => {
  it("exports owned personal records and actual media and excludes team records by default", async () => {
    const result = await exportPersonalCopy();
    const restored = await decodeBackup(result.text);
    expect(result.counts).toEqual({ customers: 1, todos: 1, media: 1 });
    expect(result.excludedCustomers).toBe(1);
    expect(result.excludedTodos).toBe(1);
    expect(restored.customers[0].personalNotes).toBe("Private note");
    expect(restored.customers[0].wants).toContain("Wide");
    expect(restored.media[0].data).toMatch(/^data:image\/png;base64,/);
    expect(restored.customers[0].custom).toEqual({ heel: "low" });
  });
  it("includes owned team customers only when explicitly selected", async () => {
    expect((await exportPersonalCopy(true)).counts.customers).toBe(2);
  });
  it("copies renamed fields and appearance preferences", async () => {
    localStorage.setItem("noted.settings.v1", JSON.stringify({ theme: "cubs", font: "kalam", labels: { shoe_size: "Size", looking_for: "Wishlist" } }));
    const n = await decodeBackup((await exportPersonalCopy()).text);
    expect(n.settings.theme).toBe("cubs");
    expect(n.settings.font).toBe("kalam");
    expect(n.settings.labels.shoe_size).toBe("Size");
    expect(n.settings.labels.looking_for).toBe("Wishlist");
  });
  it("reads beyond the first page and preserves completed/scheduled tasks", async () => {
    state.tables.customers = Array.from({ length: 501 }, (_, i) => ({ ...state.tables.customers[0], id: "c" + i }));
    state.tables.todos = [{ id: "t", title: "Follow up", customer_id: "c500", done: true, due_at: "2026-11-20T15:00:00Z", position: 7 }];
    state.tables.photos = []; state.tables.customer_personal_details = [];
    const n = await decodeBackup((await exportPersonalCopy()).text);
    expect(n.customers).toHaveLength(501);
    expect(n.todos[0]).toMatchObject({ customerId: "c500", done: true, due: "2026-11-20T15:00:00Z", position: 7 });
  });
  it("stops if any required table is unreadable", async () => {
    state.failTable = "drawings";
    await expect(exportPersonalCopy()).rejects.toThrow("Could not read drawings");
  });
  it("requires the owner's signed-in session", async () => {
    state.signedIn = false;
    await expect(exportPersonalCopy()).rejects.toThrow("Sign in");
    expect(state.calls).toEqual([]);
  });
  it("refuses to produce a partial backup when a picture is unavailable", async () => {
    state.failMedia = true;
    await expect(exportPersonalCopy()).rejects.toThrow("No incomplete backup");
  });
});
