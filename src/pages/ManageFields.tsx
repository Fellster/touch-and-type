import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Field = { id: string; key: string; label: string; field_type: string; sort_order: number };

const TYPES = [
  { v: "text", l: "Text" },
  { v: "number", l: "Number" },
  { v: "tags", l: "Tags" },
  { v: "date", l: "Date" },
  { v: "boolean", l: "Yes / No" },
];

export default function ManageFields() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [fields, setFields] = useState<Field[]>([]);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");

  const load = async () => {
    const { data, error } = await supabase.from("custom_fields").select("*").order("sort_order");
    if (error) return toast.error(error.message);
    setFields((data ?? []) as Field[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("custom_fields").insert({
      user_id: user!.id, key, label: trimmed, field_type: type, sort_order: fields.length,
    });
    if (error) return toast.error(error.message);
    setLabel("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this field? Existing values stay on customer records.")) return;
    const { error } = await supabase.from("custom_fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-5 pt-6 pb-24">
      <Button variant="ghost" size="sm" onClick={() => nav("/")} className="mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>
      <h1 className="font-serif text-3xl mb-2">Custom fields</h1>
      <p className="text-sm text-muted-foreground mb-6">Add any extra fields you want on every customer page. They're searchable and sortable.</p>

      <Card className="p-4 mb-6 space-y-3">
        <div>
          <Label>Field name</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Heel preference" maxLength={50} />
        </div>
        <div>
          <Label>Type</Label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Add field</Button>
      </Card>

      <div className="space-y-2">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No custom fields yet.</p>
        ) : fields.map((f) => (
          <Card key={f.id} className="p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{f.label}</div>
              <div className="text-xs text-muted-foreground">{TYPES.find((t) => t.v === f.field_type)?.l}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(f.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </main>
  );
}
