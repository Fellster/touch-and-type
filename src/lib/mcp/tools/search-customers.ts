import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_customers",
  title: "Search customers",
  description:
    "Search the customer notebook by name, phone, email, designer, or 'looking for' tags. Returns up to 50 matches.",
  inputSchema: {
    query: z.string().trim().min(1).optional().describe("Text to match. Omit to list recent customers."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("customers")
      .select("id,name,phone,email,designers,looking_for,shoe_size,width,typed_notes,updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (query) {
      const like = `%${query}%`;
      q = q.or(
        `name.ilike.${like},phone.ilike.${like},email.ilike.${like},typed_notes.ilike.${like}`,
      );
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    // Post-filter for array fields if a query was provided.
    const filtered = query
      ? (data ?? []).filter((c: any) => {
          const hay = [
            c.name,
            c.phone,
            c.email,
            c.typed_notes,
            ...(c.designers ?? []),
            ...(c.looking_for ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(query.toLowerCase());
        })
      : data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(filtered) }],
      structuredContent: { customers: filtered },
    };
  },
});
