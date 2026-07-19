import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_customer",
  title: "Create customer",
  description: "Add a new customer to the notebook.",
  inputSchema: {
    name: z.string().trim().min(1),
    phone: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    designers: z.array(z.string()).optional().describe("Preferred designers, e.g. ['Manolo','Aquazzura']."),
    shoe_size: z.number().optional(),
    width: z.enum(["Narrow", "Medium", "Wide"]).optional(),
    looking_for: z.array(z.string()).optional(),
    typed_notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("customers")
      .insert({
        user_id: ctx.getUserId(),
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        designers: input.designers ?? [],
        looking_for: input.looking_for ?? [],
        shoe_size: input.shoe_size ?? null,
        width: input.width ?? null,
        typed_notes: input.typed_notes ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created customer: ${data.name}` }],
      structuredContent: { customer: data },
    };
  },
});
