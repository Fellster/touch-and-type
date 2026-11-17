import type { ParsedResult, VoiceContext } from "@/components/VoiceCapture";
/** Dictation only: never invent names, customer fields, or dates from free text. */
export function entryFromDictation(text: string, context: VoiceContext): ParsedResult {
  const transcript = text.trim();
  if (context === "todo") return { intent: "todo", transcript, todo: { title: transcript, due_at: null } };
  if (context === "notes" || context === "customer") return { intent: "note", transcript, note_append: transcript };
  return { intent: "unknown", transcript };
}
