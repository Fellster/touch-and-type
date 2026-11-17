import { z } from "zod";
const id = z.string().min(1).max(100);
const strings = z.array(z.string()).max(1000);
const stamp = z.string().datetime({ offset: true });
const customer = z
  .object({
    id,
    name: z.string().trim().min(1).max(300),
    phone: z.string().max(100),
    email: z.string().max(500),
    designers: strings,
    shoeSize: z.string().max(100),
    width: z.string().max(100),
    wants: strings,
    notes: z.string().max(1000000),
    personalNotes: z.string().max(1000000),
    custom: z.record(z.string(), z.unknown()),
    updatedAt: stamp,
  })
  .strict();
const todo = z
  .object({
    id,
    customerId: id.nullable(),
    title: z.string().trim().min(1).max(20000),
    due: z
      .string()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid due date"),
    done: z.boolean(),
    position: z.number().finite(),
  })
  .strict();
const media = z
  .object({
    id,
    customerId: id,
    kind: z.enum(["photo", "drawing"]),
    name: z.string().max(500),
    data: z
      .string()
      .max(14000000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
    text: z.string().max(1000000),
  })
  .strict();
export const notebookSchema = z
  .object({
    customers: z.array(customer).max(100000),
    todos: z.array(todo).max(100000),
    media: z.array(media).max(10000),
    settings: z
      .object({
        theme: z.enum(["warm", "paper", "cubs", "bears", "yankees"]),
        accent: z.enum(["theme", "black", "blue", "green", "red"]),
        font: z.enum(["inter", "lora", "manrope", "kalam"]),
        calendar: z.enum(["google", "apple", "outlook"]),
      })
      .strict(),
    // Preserve custom-field definitions from the online notebook, including fields not yet rendered.
    customFields: z.array(z.record(z.string(), z.unknown())).max(1000),
  })
  .strict()
  .superRefine((n, ctx) => {
    for (const [key, rows] of [
      ["customers", n.customers],
      ["todos", n.todos],
      ["media", n.media],
    ] as const) {
      const ids = rows.map((row) => row.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: "custom", message: "Duplicate " + key + " IDs" });
    }
    const ids = new Set(n.customers.map((c) => c.id));
    if (
      n.todos.some((t) => t.customerId && !ids.has(t.customerId)) ||
      n.media.some((m) => !ids.has(m.customerId))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Some items refer to a missing customer",
      });
    }
  });
export type Notebook = z.infer<typeof notebookSchema>;
export type Customer = Notebook["customers"][number];
export type Todo = Notebook["todos"][number];
export const emptyNotebook = (): Notebook => ({
  customers: [],
  todos: [],
  media: [],
  customFields: [],
  settings: {
    theme: "warm",
    accent: "theme",
    font: "inter",
    calendar: "google",
  },
});
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export function validateNotebook(value: unknown): Notebook {
  return notebookSchema.parse(value);
}
export function deleteCustomer(n: Notebook, id: string): Notebook {
  return {
    ...n,
    customers: n.customers.filter((c) => c.id !== id),
    todos: n.todos.filter((t) => t.customerId !== id),
    media: n.media.filter((m) => m.customerId !== id),
  };
}
