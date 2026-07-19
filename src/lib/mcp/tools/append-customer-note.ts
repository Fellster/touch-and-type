import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "append_customer_note",
  title: "Append customer note",
  description: "Append a line to a customer's typed notes (adds a timestamp prefix).",
  inputSchema: {
    id: z.string().uuid(),
    note: z.string().trim().min(1),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, note }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const sb = supabaseForUser(ctx);
    const { data: cur, error: readErr } = await sb
      .from("customers")
      .select("typed_notes")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return { content: [{ type: "text", text: readErr.message }], isError: true };
    if (!cur) return { content: [{ type: "text", text: "Customer not found" }], isError: true };
    const stamp = new Date().toISOString().slice(0, 10);
    const next = [cur.typed_notes, `[${stamp}] ${note}`].filter(Boolean).join("\n");
    const { data, error } = await sb
      .from("customers")
      .update({ typed_notes: next })
      .eq("id", id)
      .select("id,typed_notes")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: "Note appended." }],
      structuredContent: { customer: data },
    };
  },
});
