import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "multipart/form-data required" }, 400);
    }

    const form = await req.formData();
    const audio = form.get("audio");
    const context = String(form.get("context") ?? "global");
    const nowIso = String(form.get("now") ?? new Date().toISOString());
    const tz = String(form.get("tz") ?? "UTC");

    if (!(audio instanceof File) && !(audio instanceof Blob)) {
      return json({ error: "audio file required" }, 400);
    }
    const audioBlob = audio as Blob;
    if (audioBlob.size === 0) return json({ error: "Empty audio" }, 400);
    if (audioBlob.size > 25 * 1024 * 1024) return json({ error: "Audio too large" }, 413);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    // Derive extension from MIME so gateway/provider can decode
    const mime = (audio as File).type || audioBlob.type || "audio/webm";
    const ext =
      mime.includes("mp4") ? "mp4"
      : mime.includes("mpeg") ? "mp3"
      : mime.includes("wav") ? "wav"
      : mime.includes("ogg") ? "ogg"
      : "webm";

    // 1) Transcribe
    const sttForm = new FormData();
    sttForm.append("model", "openai/gpt-4o-transcribe");
    sttForm.append("file", audioBlob, `recording.${ext}`);
    const sttRes = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: sttForm,
    });
    if (!sttRes.ok) {
      const t = await sttRes.text();
      console.error("STT error", sttRes.status, t);
      if (sttRes.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
      if (sttRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "Transcription failed" }, 500);
    }
    const sttJson = await sttRes.json();
    const transcript: string = (sttJson?.text ?? "").trim();
    if (!transcript) return json({ transcript: "", parsed: { intent: "unknown" } });

    // 2) Parse into structured intent
    const system = `You extract structured data from short voice memos from a footwear salesperson.

Return STRICT JSON with this exact shape (omit unknown fields, use null):
{
  "intent": "todo" | "customer" | "note" | "unknown",
  "todo": { "title": string, "due_at": string|null },
  "customer": {
    "name": string|null,
    "phone": string|null,
    "email": string|null,
    "designers": string[],
    "looking_for": string[],
    "shoe_size": number|null,
    "width": "Narrow"|"Medium"|"Wide"|null,
    "notes": string|null
  },
  "note_append": string|null
}

Rules:
- Context hint: "${context}". If "todo", prefer intent=todo. If "customer" or "notes", prefer intent=customer or note.
- "add customer ...", "new customer ..." => intent=customer.
- "call/remind/follow up/todo ..." => intent=todo.
- Parse dates/times relative to now=${nowIso} (timezone ${tz}). "tomorrow at 10am", "next Tuesday", "Friday" -> ISO 8601 with timezone offset for due_at.
- Phone: normalize to digits with dashes if given; keep as-is if unclear.
- shoe_size is a number (e.g. 11, 8.5). width mapped only if user says narrow/medium/wide.
- designers/looking_for are short arrays (brand names or item descriptions like "Birkenstock Arizona").
- todo.title: concise imperative. Include the person's name if mentioned. Do NOT put ISO date in title.
- If it's an update to an existing customer's notes (context="notes"), set intent=note and put the free text in note_append.
- Respond with JSON only, no prose, no code fences.`;

    const chatRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: transcript },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!chatRes.ok) {
      const t = await chatRes.text();
      console.error("Parse error", chatRes.status, t);
      return json({ transcript, parsed: { intent: "unknown" }, warning: "parse_failed" });
    }
    const chatJson = await chatRes.json();
    const raw = chatJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = { intent: "unknown" };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // try to salvage JSON
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    return json({ transcript, parsed });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
