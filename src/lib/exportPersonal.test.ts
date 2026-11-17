import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { exportPersonalCopy } from "./exportPersonal";
import { decodeBackup } from "../../personal/src/backup";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  failMedia: false,
  calls: [] as string[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "owner" } }, error: null }),
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
                  error: null,
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
  it("refuses to produce a partial backup when a picture is unavailable", async () => {
    state.failMedia = true;
    await expect(exportPersonalCopy()).rejects.toThrow("No incomplete backup");
  });
});
