import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_todo",
  title: "Complete or reopen to-do",
  description: "Mark a to-do as done or not done.",
  inputSchema: {
    id: z.string().uuid().describe("Todo id."),
    done: z.boolean().describe("true = mark done, false = reopen."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, done }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("todos")
      .update({ done })
      .eq("id", id)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: done ? "Marked done" : "Reopened" }],
      structuredContent: { todo: data },
    };
  },
});
