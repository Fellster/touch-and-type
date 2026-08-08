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
import { supabase } from "@/integrations/supabase/client";
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
  const fieldLabels = useLabels();

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => stopStream(), []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    chunksRef.current = [];
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Pick a MIME the browser supports.
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
      ];
      let mime = "";
      for (const c of candidates) {
        if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(c)) {
          mime = c;
          break;
        }
      }
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => finish(mime || rec.mimeType || "audio/webm");
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("Microphone access denied");
    }
  };

  const stop = () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop();
    }
    setRecording(false);
  };

  const finish = async (mime: string) => {
    setProcessing(true);
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      stopStream();
      if (blob.size < 1200) {
        toast.error("Recording too short — try again");
        setProcessing(false);
        return;
      }
      const form = new FormData();
      form.append("audio", blob, `recording.${mime.includes("mp4") ? "mp4" : "webm"}`);
      form.append("context", context);
      form.append("now", new Date().toISOString());
      form.append("tz", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

      const { data, error } = await supabase.functions.invoke("voice-parse", { body: form });
      if (error) {
        const details =
          typeof (error as any)?.context?.text === "function"
            ? await (error as any).context.text().catch(() => "")
            : "";
        console.error("voice-parse failed", error, details);
        toast.error("Voice parsing failed");
        setProcessing(false);
        return;
      }
      const transcript = (data as any)?.transcript ?? "";
      const parsed = (data as any)?.parsed ?? { intent: "unknown" };
      if (!transcript) {
        toast.error("Couldn't hear anything — try again");
        setProcessing(false);
        return;
      }
      setResult({ ...parsed, transcript });
      setOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const onClick = () => {
    if (processing) return;
    if (recording) stop();
    else start();
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
                <Input value={draft.customer?.phone ?? ""} onChange={(e) => setCust({ phone: e.target.value })} />
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
              <Field label={`${fieldLabels.looking_for} (comma-separated)`} full>
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
          <Button onClick={() => draft && onSave(draft)}>Save</Button>
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
