import { supabase } from "@/integrations/supabase/client";
import { emptyNotebook, type Notebook } from "./personalNotebook";
import { encodeBackup, decodeBackup } from "./personalBackup";
const db = supabase as any;
async function rows(table: string, userId: string) {
  const all: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        "Could not read " + table + ". Nothing was changed online.",
      );
    all.push(...(data ?? []));
    if (!data || data.length < 500) return all;
  }
}
const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(
        new Error(
          "Could not read picture. No incomplete backup was downloaded.",
        ),
      );
    reader.readAsDataURL(blob);
  });
export async function exportPersonalCopy(includeOwnedTeamCustomers = false) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    throw new Error("Sign in before copying your notebook.");
  const userId = auth.user.id;
  const [customers, todos, photos, drawings, details, fields] =
    await Promise.all(
      [
        "customers",
        "todos",
        "photos",
        "drawings",
        "customer_personal_details",
        "custom_fields",
      ].map((table) => rows(table, userId)),
    );
  const owned = customers.filter(
    (c) => includeOwnedTeamCustomers || !c.team_id,
  );
  const ids = new Set(owned.map((c) => c.id));
  const n: Notebook = emptyNotebook();
  n.customFields = fields;
  n.customers = owned.map((c) => {
    const personal = details.find((d) => d.customer_id === c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone ?? "",
      email: c.email ?? "",
      designers: c.designers ?? [],
      shoeSize: c.shoe_size == null ? "" : String(c.shoe_size),
      width: c.width ?? "",
      wants: [
        ...new Set<string>([
          ...(c.looking_for ?? []),
          ...(personal?.wants ?? []),
        ]),
      ],
      notes: c.typed_notes ?? "",
      personalNotes: personal?.notes ?? "",
      custom: c.custom_data ?? {},
      updatedAt: c.updated_at,
    };
  });
  const includedTodos = todos.filter(
    (t) => !t.customer_id || ids.has(t.customer_id),
  );
  n.todos = includedTodos.map((t, index) => ({
    id: t.id,
    customerId: t.customer_id ?? null,
    title: t.title,
    due: t.due_at ?? "",
    done: !!t.done,
    position: t.position ?? index,
  }));
  for (const [kind, mediaRows, bucket] of [
    ["photo", photos, "photos"],
    ["drawing", drawings, "drawings"],
  ] as const) {
    for (const m of mediaRows.filter((m) => ids.has(m.customer_id))) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(m.storage_path);
      if (error || !data)
        throw new Error(
          "A " +
            kind +
            " could not be downloaded. No incomplete backup was downloaded.",
        );
      n.media.push({
        id: m.id,
        customerId: m.customer_id,
        kind,
        name: m.storage_path.split("/").slice(-1)[0] ?? kind,
        data: await dataUrl(data),
        text: m.ocr_text ?? "",
      });
    }
  }
  try {
    const settings = JSON.parse(
      localStorage.getItem("noted.settings.v1") ?? "{}",
    );
    for (const key of ["theme", "accent", "font"] as const) {
      const allowed = {
        theme: ["warm", "paper", "cubs", "bears", "yankees"],
        accent: ["theme", "black", "blue", "green", "red"],
        font: ["inter", "lora", "manrope", "kalam"],
      }[key];
      if (allowed.includes(settings[key]))
        (n.settings as any)[key] = settings[key];
    }
    if (settings.labels && typeof settings.labels === "object") {
      for (const key of ["designers", "shoe_size", "width", "looking_for"] as const) {
        const value = settings.labels[key];
        if (typeof value === "string" && value.trim() && value.trim().length <= 40)
          n.settings.labels[key] = value.trim();
      }
    }
    const calendar = localStorage.getItem("noted:calendar-provider");
    if (calendar === "apple" || calendar === "outlook")
      n.settings.calendar = calendar;
  } catch {
    /* Default settings remain; customer records are unaffected. */
  }
  const text = await encodeBackup(n);
  // Verify the actual file representation, not only the in-memory object.
  const restored = await decodeBackup(text);
  if (
    restored.customers.length !== owned.length ||
    restored.todos.length !== includedTodos.length ||
    restored.media.length !==
      [...photos, ...drawings].filter((m) => ids.has(m.customer_id)).length
  )
    throw new Error("Copy verification failed. No file downloaded.");
  return {
    text,
    counts: {
      customers: n.customers.length,
      todos: n.todos.length,
      media: n.media.length,
    },
    excludedCustomers: customers.length - owned.length,
    excludedTodos: todos.length - includedTodos.length,
  };
}
