import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_todos",
  title: "List to-dos",
  description: "List the signed-in user's to-do items, optionally filtered by completion status.",
  inputSchema: {
    done: z.boolean().optional().describe("If set, only return todos with this completion status."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ done, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("todos")
      .select("id,title,due_at,done,created_at,position")
      .order("position", { ascending: true })
      .limit(limit ?? 50);
    if (typeof done === "boolean") q = q.eq("done", done);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { todos: data ?? [] },
    };
  },
});
