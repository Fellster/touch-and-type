import { PhoneInput } from "@/components/PhoneInput";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Mic, Square, Loader2 } from "lucide-react";
import { startDictation, type SpeechSession } from "@/lib/voice/dictation";
import { entryFromDictation } from "@/lib/voice/entry";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { useLabels } from "@/hooks/useSettings";

export type VoiceContext = "todo" | "customer" | "notes" | "global";

export type ParsedTodo = { title: string; due_at: string | null };
export type ParsedCustomer = {
  name: string | null;
  phone: string | null;
  email: string | null;
  designers: string[];
  looking_for: string[];
  shoe_size: number | null;
  width: "Narrow" | "Medium" | "Wide" | null;
  notes: string | null;
};
export type ParsedResult = {
  intent: "todo" | "customer" | "note" | "unknown";
  transcript: string;
  todo?: ParsedTodo;
  customer?: ParsedCustomer;
  note_append?: string | null;
};

type Props = {
  context: VoiceContext;
  /** Called after user reviews and clicks Save. Return a promise if async. */
  onCommit: (result: ParsedResult) => void | Promise<void>;
  /** Optional label under transcript when reviewing a note append. */
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  title?: string;
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export default function VoiceCapture({
  context,
  onCommit,
  size = "icon",
  variant = "outline",
  className,
  title = "Voice input",
}: Props) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ParsedResult | null>(null);
  

  const sessionRef = useRef<SpeechSession | null>(null);
  const mounted = useRef(true);
  const active = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [entryText, setEntryText] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; sessionRef.current?.cancel(); };
  }, []);
  const start = async () => {
    if (active.current) return;
    active.current = true;
    try {
      const session = startDictation();
      sessionRef.current = session;
      setRecording(true);
      const transcript = await session.result;
      if (!mounted.current) return;
      if (!transcript) {
        toast.error("Couldn't hear anything. Try again or type your entry.");
        setHelpOpen(true); return;
      }
      setResult(entryFromDictation(transcript, context)); setOpen(true);
    } catch (e) {
      if (mounted.current) {
        toast.error(e instanceof Error ? e.message : "Could not start voice input.");
        setHelpOpen(true);
      }
    } finally {
      active.current = false; sessionRef.current = null;
      if (mounted.current) { setRecording(false); setProcessing(false); }
    }
  };
  const stop = () => {
    sessionRef.current?.stop(); setRecording(false); setProcessing(true);
  };

  const onClick = () => {
    if (processing) return;
    if (recording) stop();
    else setHelpOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={onClick}
        aria-label={recording ? "Stop recording" : title}
        title={title}
        className={className}
      >
        {processing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4 text-destructive fill-destructive" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice entry</DialogTitle>
            <DialogDescription>
              {Capacitor.getPlatform() === "android"
                ? "Uses on-device speech recognition. Review the text before saving."
                : "Your browser's speech service may send audio online. You can also type below or use your keyboard microphone."}
            </DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Voice entry text" placeholder="Type here, or use your keyboard microphone" value={entryText} onChange={e => setEntryText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              if (!entryText.trim()) { toast.error("Enter some text first."); return; }
              setResult(entryFromDictation(entryText, context)); setHelpOpen(false); setOpen(true);
            }}>Review text</Button>
            <Button onClick={() => { setHelpOpen(false); void start(); }}>Start dictation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReviewDialog
        open={open}
        onOpenChange={setOpen}
        result={result}
        onSave={async (r) => {
          await onCommit(r);
          setOpen(false);
          setResult(null);
        }}
      />
    </>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  result,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: ParsedResult | null;
  onSave: (r: ParsedResult) => void | Promise<void>;
}) {
  const labels = useLabels();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ParsedResult | null>(result);
  useEffect(() => setDraft(result), [result]);

  if (!draft) return null;
  const intent = draft.intent;

  const setTodo = (patch: Partial<ParsedTodo>) =>
    setDraft({
      ...draft,
      todo: { title: "", due_at: null, ...(draft.todo ?? {}), ...patch },
    });
  const setCust = (patch: Partial<ParsedCustomer>) =>
    setDraft({
      ...draft,
      customer: {
        name: null,
        phone: null,
        email: null,
        designers: [],
        looking_for: [],
        shoe_size: null,
        width: null,
        notes: null,
        ...(draft.customer ?? {}),
        ...patch,
      },
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review voice entry</DialogTitle>
          <DialogDescription>Edit anything before saving.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/40">
            <span className="uppercase tracking-wide">Heard:</span> "{draft.transcript}"
          </div>

          <div>
            <Label>Intent</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={intent}
              onChange={(e) => setDraft({ ...draft, intent: e.target.value as any })}
            >
              <option value="todo">To-do</option>
              <option value="customer">New customer</option>
              <option value="note">Note (append)</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          {intent === "todo" && (
            <>
              <div>
                <Label htmlFor="v-todo-title">Task</Label>
                <Textarea
                  id="v-todo-title"
                  value={draft.todo?.title ?? draft.transcript}
                  onChange={(e) => setTodo({ title: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="v-todo-due">Due (optional)</Label>
                <Input
                  id="v-todo-due"
                  type="datetime-local"
                  value={toLocalInput(draft.todo?.due_at ?? null)}
                  onChange={(e) => setTodo({ due_at: fromLocalInput(e.target.value) })}
                />
              </div>
            </>
          )}

          {intent === "customer" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name">
                <Input value={draft.customer?.name ?? ""} onChange={(e) => setCust({ name: e.target.value })} />
              </Field>
              <Field label="Phone">
                <PhoneInput value={draft.customer?.phone ?? ""} onValueChange={(phone) => setCust({ phone })} />
              </Field>
              <Field label="Email">
                <Input value={draft.customer?.email ?? ""} onChange={(e) => setCust({ email: e.target.value })} />
              </Field>
              <Field label="Shoe size">
                <Input
                  type="number"
                  step="0.5"
                  value={draft.customer?.shoe_size ?? ""}
                  onChange={(e) => setCust({ shoe_size: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </Field>
              <Field label="Width">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.customer?.width ?? ""}
                  onChange={(e) => setCust({ width: (e.target.value || null) as any })}
                >
                  <option value="">—</option>
                  <option value="Narrow">Narrow</option>
                  <option value="Medium">Medium</option>
                  <option value="Wide">Wide</option>
                </select>
              </Field>
              <Field label="Designers (comma-separated)" full>
                <Input
                  value={(draft.customer?.designers ?? []).join(", ")}
                  onChange={(e) =>
                    setCust({ designers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                  }
                />
              </Field>
              <Field label={`${labels.looking_for} (comma-separated)`} full>
                <Input
                  value={(draft.customer?.looking_for ?? []).join(", ")}
                  onChange={(e) =>
                    setCust({ looking_for: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                  }
                />
              </Field>
              <Field label="Notes" full>
                <Textarea
                  rows={2}
                  value={draft.customer?.notes ?? ""}
                  onChange={(e) => setCust({ notes: e.target.value })}
                />
              </Field>
            </div>
          )}

          {intent === "note" && (
            <div>
              <Label htmlFor="v-note">Note to append</Label>
              <Textarea
                id="v-note"
                rows={4}
                value={draft.note_append ?? draft.transcript}
                onChange={(e) => setDraft({ ...draft, note_append: e.target.value })}
              />
            </div>
          )}

          {intent === "unknown" && (
            <p className="text-sm text-muted-foreground">
              Couldn't classify. Pick an intent above to save this as a task, customer, or note.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving || !draft.transcript.trim()} onClick={async () => {
            if (!draft || saving) return;
            setSaving(true);
            try { await onSave(draft); }
            catch { toast.error("Couldn't save. Your entry is still here; try again."); }
            finally { setSaving(false); }
          }}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
