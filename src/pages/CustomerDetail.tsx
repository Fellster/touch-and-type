import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Plus, X, Camera, Pencil, Sparkles, Copy, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import DrawingCanvas from "@/components/DrawingCanvas";
import SEO from "@/components/SEO";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  designers: string[];
  shoe_size: number | null;
  width: string | null;
  looking_for: string[];
  typed_notes: string | null;
  custom_data: Record<string, any>;
};

type CustomField = { id: string; key: string; label: string; field_type: string; sort_order: number };
type Drawing = { id: string; storage_path: string; ocr_text: string | null; url?: string };
type Photo = { id: string; storage_path: string; url?: string };

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showCanvas, setShowCanvas] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!id) return;
    const [c, f, d, p] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("custom_fields").select("*").order("sort_order"),
      supabase.from("drawings").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      supabase.from("photos").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    ]);
    if (c.error) { toast.error(c.error.message); return; }
    setCustomer(c.data as Customer);
    setFields((f.data ?? []) as CustomField[]);

    const ds = (d.data ?? []) as Drawing[];
    const ps = (p.data ?? []) as Photo[];
    for (const x of ds) {
      const { data } = await supabase.storage.from("drawings").createSignedUrl(x.storage_path, 3600);
      x.url = data?.signedUrl;
    }
    for (const x of ps) {
      const { data } = await supabase.storage.from("photos").createSignedUrl(x.storage_path, 3600);
      x.url = data?.signedUrl;
    }
    setDrawings(ds);
    setPhotos(ps);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (customer && searchParams.get("new") === "1" && customer.name === "New customer") {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
      setSearchParams({}, { replace: true });
    }
  }, [customer, searchParams]);

  const update = (patch: Partial<Customer>) => {
    if (!customer) return;
    const next = { ...customer, ...patch };
    setCustomer(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const { id: _id, ...rest } = next;
      const { error } = await supabase.from("customers").update(rest).eq("id", customer.id);
      if (error) toast.error(error.message);
    }, 500);
  };

  const updateCustom = (key: string, value: any) => {
    if (!customer) return;
    update({ custom_data: { ...customer.custom_data, [key]: value } });
  };

  const removeCustomer = async () => {
    if (!customer || !confirm("Delete this customer and all their notes?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) return toast.error(error.message);
    nav("/");
  };

  const saveDrawing = async (blob: Blob, ocr?: string) => {
    if (!customer || !user) return;
    const path = `${user.id}/${customer.id}/${Date.now()}.png`;
    const up = await supabase.storage.from("drawings").upload(path, blob, { contentType: "image/png" });
    if (up.error) return toast.error(up.error.message);
    const { error } = await supabase.from("drawings").insert({
      customer_id: customer.id,
      user_id: user.id,
      storage_path: path,
      ocr_text: ocr ?? null,
    });
    if (error) return toast.error(error.message);
    setShowCanvas(false);
    toast.success(ocr ? "Drawing saved & transcribed" : "Drawing saved");
    load();
  };

  const saveAndTranscribe = async (dataUrl: string) => {
    const base64 = dataUrl.split(",")[1];
    const res = await supabase.functions.invoke("ocr-handwriting", { body: { imageBase64: base64 } });
    if (res.error) {
      toast.error(res.error.message ?? "Transcription failed");
      return;
    }
    const text = (res.data as any)?.text ?? "";
    const blob = await (await fetch(dataUrl)).blob();
    await saveDrawing(blob, text);
  };

  const transcribeExisting = async (d: Drawing) => {
    if (!d.url) return;
    toast.info("Transcribing…");
    const img = await fetch(d.url);
    const blob = await img.blob();
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await supabase.functions.invoke("ocr-handwriting", { body: { imageBase64: base64 } });
      if (res.error) return toast.error(res.error.message ?? "Failed");
      const text = (res.data as any)?.text ?? "";
      const { error } = await supabase.from("drawings").update({ ocr_text: text }).eq("id", d.id);
      if (error) return toast.error(error.message);
      toast.success("Transcribed");
      load();
    };
    reader.readAsDataURL(blob);
  };

  const removeDrawing = async (d: Drawing) => {
    await supabase.storage.from("drawings").remove([d.storage_path]);
    await supabase.from("drawings").delete().eq("id", d.id);
    load();
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !customer || !user) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10 MB");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${customer.id}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from("photos").upload(path, file, { contentType: file.type });
    if (up.error) return toast.error(up.error.message);
    await supabase.from("photos").insert({ customer_id: customer.id, user_id: user.id, storage_path: path });
    e.target.value = "";
    load();
  };

  const removePhoto = async (p: Photo) => {
    await supabase.storage.from("photos").remove([p.storage_path]);
    await supabase.from("photos").delete().eq("id", p.id);
    load();
  };

  if (!customer) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <main className="min-h-screen pb-32 max-w-3xl mx-auto px-5 pt-6">
      <SEO
        title={`${customer.name || "Customer"} — Atelier`}
        description={`Customer notes for ${customer.name || "this customer"} — designers, sizes, wishlist, and handwritten notes.`}
        path={`/c/${customer.id}`}
      />
      <div className="flex justify-between items-center mb-4">
        <Button variant="ghost" size="sm" onClick={() => nav("/")}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button variant="ghost" size="sm" onClick={removeCustomer} aria-label="Delete this customer"><Trash2 className="h-4 w-4" /></Button>
      </div>

      <h1 className="sr-only">{customer.name || "Untitled customer"}</h1>
      <label htmlFor="customer-name" className="sr-only">Customer name</label>
      <Input
        id="customer-name"
        ref={nameInputRef}
        value={customer.name}
        onChange={(e) => update({ name: e.target.value })}
        aria-label="Customer name"
        className="text-3xl md:text-4xl font-serif h-auto py-2 border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
        placeholder="Customer name"
      />

      <Card className="p-4 mt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cust-phone">Phone</Label>
            <div className="flex gap-2">
              <Input id="cust-phone" className="flex-1" value={customer.phone ?? ""} onChange={(e) => update({ phone: e.target.value })} />
              <Button variant="outline" size="icon" aria-label="Copy phone number" disabled={!customer.phone} onClick={async () => { if (customer.phone) { await navigator.clipboard.writeText(customer.phone); toast.success("Phone copied"); } }}><Copy className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Call phone number" disabled={!customer.phone} onClick={() => { if (customer.phone) { window.location.href = `tel:${customer.phone.replace(/[^\d+]/g, "")}`; } }}><Phone className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <Label htmlFor="cust-email">Email</Label>
            <div className="flex gap-2">
              <Input id="cust-email" className="flex-1" type="email" value={customer.email ?? ""} onChange={(e) => update({ email: e.target.value })} />
              <Button variant="outline" size="icon" asChild aria-label="Send email" disabled={!customer.email}><a href={customer.email ? `mailto:${customer.email}` : undefined}><Mail className="h-4 w-4" /></a></Button>
            </div>
          </div>
          <div>
            <Label htmlFor="cust-shoesize">Shoe size</Label>
            <Input
              id="cust-shoesize"
              type="number" step="0.5" min="3" max="14"
              value={customer.shoe_size ?? ""}
              onChange={(e) => update({ shoe_size: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="cust-width">Width</Label>
            <select
              id="cust-width"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={customer.width ?? ""}
              onChange={(e) => update({ width: e.target.value || null })}
            >
              <option value="">—</option>
              <option value="Narrow">Narrow</option>
              <option value="Medium">Medium</option>
              <option value="Wide">Wide</option>
            </select>
          </div>
        </div>

        <TagEditor label="Designers" values={customer.designers} onChange={(v) => update({ designers: v })} />
        <TagEditor label="Looking for" values={customer.looking_for} onChange={(v) => update({ looking_for: v })} />

        {fields.length > 0 && (
          <div className="pt-2 border-t space-y-3">
            {fields.map((f) => (
              <CustomFieldInput
                key={f.id}
                field={f}
                value={customer.custom_data?.[f.key]}
                onChange={(v) => updateCustom(f.key, v)}
              />
            ))}
          </div>
        )}
      </Card>

      <section className="mt-6">
        <h2 className="font-serif text-2xl mb-2">
          <label htmlFor="cust-notes">Notes</label>
        </h2>
        <Textarea
          id="cust-notes"
          value={customer.typed_notes ?? ""}
          onChange={(e) => update({ typed_notes: e.target.value })}
          placeholder="Type any notes here…"
          rows={6}
        />
      </section>

      <section className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-serif text-2xl">Drawings</h2>
          {!showCanvas && (
            <Button size="sm" onClick={() => setShowCanvas(true)} aria-label="Add new drawing">
              <Pencil className="h-4 w-4 mr-1" />New
            </Button>
          )}
        </div>
        {showCanvas && (
          <Card className="p-3 mb-3">
            <DrawingCanvas
              onSave={async (b) => { await saveDrawing(b); }}
              onCancel={() => setShowCanvas(false)}
              onOcr={saveAndTranscribe}
            />
          </Card>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {drawings.map((d) => (
            <Card key={d.id} className="p-2 space-y-2">
              {d.url && (
                <img
                  src={d.url}
                  alt={d.ocr_text ? `Handwritten note: ${d.ocr_text.slice(0, 120)}` : `Sketch for ${customer.name || "customer"}`}
                  className="w-full rounded border bg-white"
                />
              )}
              {d.ocr_text ? (
                <p className="text-sm whitespace-pre-wrap px-1">{d.ocr_text}</p>
              ) : (
                <Button size="sm" variant="secondary" className="w-full" onClick={() => transcribeExisting(d)}>
                  <Sparkles className="h-4 w-4 mr-1" />Transcribe handwriting
                </Button>
              )}
              <Button size="sm" variant="ghost" className="w-full" onClick={() => removeDrawing(d)} aria-label="Delete drawing">
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-serif text-2xl">Photos</h2>
          <Button size="sm" onClick={() => fileInput.current?.click()} aria-label="Add photo">
            <Camera className="h-4 w-4 mr-1" />Add
          </Button>
          <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} aria-label="Upload photo" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative group">
              {p.url && <img src={p.url} alt={`Photo for ${customer.name || "customer"}`} className="w-full aspect-square object-cover rounded-md" />}
              <button
                onClick={() => removePhoto(p)}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                aria-label="Delete photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function TagEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  const inputId = useId();
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onChange([...values, v]);
    setInput("");
  };
  return (
    <div>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex flex-wrap gap-1 mb-2 mt-1">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={`Add ${label.toLowerCase()}…`}
        />
        <Button type="button" variant="outline" onClick={add} aria-label={`Add ${label.toLowerCase()}`}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function CustomFieldInput({ field, value, onChange }: { field: CustomField; value: any; onChange: (v: any) => void }) {
  const inputId = useId();
  if (field.field_type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId}>{field.label}</Label>
        <input id={inputId} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5" />
      </div>
    );
  }
  if (field.field_type === "tags") {
    return <TagEditor label={field.label} values={Array.isArray(value) ? value : []} onChange={onChange} />;
  }
  return (
    <div>
      <Label htmlFor={inputId}>{field.label}</Label>
      <Input
        id={inputId}
        type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(field.field_type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
      />
    </div>
  );
}
