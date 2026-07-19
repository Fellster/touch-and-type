import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_todo",
  title: "Create to-do",
  description: "Create a to-do item for the signed-in user. Optionally schedule a due date/time (ISO 8601).",
  inputSchema: {
    title: z.string().trim().min(1).describe("Task text."),
    due_at: z.string().datetime().optional().describe("Due date/time as ISO 8601, e.g. 2026-07-20T14:00:00Z."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, due_at }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const sb = supabaseForUser(ctx);
    const { data: maxRow } = await sb
      .from("todos")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPos = (maxRow?.position ?? 0) + 1;
    const { data, error } = await sb
      .from("todos")
      .insert({ user_id: ctx.getUserId(), title, due_at: due_at ?? null, position: nextPos })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created todo: ${data.title}` }],
      structuredContent: { todo: data },
    };
  },
});
