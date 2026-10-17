import { Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";

type CustomerInfo = {
  name: string; phone: string | null; email: string | null;
  shoe_size: number | null; width: string | null; designers: string[];
  looking_for: string[]; typed_notes: string | null; custom_data: Record<string, unknown>;
};
type Props = {
  customer: CustomerInfo;
  fields: { key: string; label: string }[];
  labels: { shoe_size: string; width: string; designers: string; looking_for: string };
  additions: { user_id: string; notes: string; wants: string[] }[];
  userId?: string;
  members: { user_id: string; email: string }[];
  drawings: { id: string; url?: string; ocr_text: string | null }[];
  photos: { id: string; url?: string }[];
};

const hasValue = (value: unknown) => value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
const displayValue = (value: unknown): string => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(displayValue).join(" · ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
};

export default function CustomerReadingView({ customer, fields, labels, additions, userId, members, drawings, photos }: Props) {
  const details = [
    { label: labels.shoe_size, value: customer.shoe_size },
    { label: labels.width, value: customer.width },
    { label: labels.designers, value: customer.designers },
    { label: labels.looking_for, value: customer.looking_for },
    ...Object.entries(customer.custom_data ?? {}).map(([key, value]) => ({ label: fields.find((field) => field.key === key)?.label ?? key.replace(/_/g, " "), value })),
  ].filter(({ value }) => hasValue(value));
  const notes = additions.filter((row) => row.notes.trim() || row.wants.length > 0);
  const hasContent = details.length > 0 || !!customer.typed_notes?.trim() || notes.length > 0 || drawings.length > 0 || photos.length > 0;
  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="font-serif text-3xl sm:text-4xl break-words">{customer.name || "Untitled customer"}</h1>
        {(customer.phone || customer.email) && <div className="space-y-2 text-base">
          {customer.phone && <a className="flex items-center gap-3 w-fit max-w-full hover:underline" href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}><Phone className="h-4 w-4 shrink-0" /><span className="break-words min-w-0">{customer.phone}</span></a>}
          {customer.email && <a className="flex items-center gap-3 w-fit max-w-full hover:underline" href={`mailto:${customer.email}`}><Mail className="h-4 w-4 shrink-0" /><span className="break-all min-w-0">{customer.email}</span></a>}
        </div>}
      </header>
      {details.length > 0 && <Card className="p-4 sm:p-5"><dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {details.map(({ label, value }, index) => <div key={index} className="min-w-0"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{displayValue(value)}</dd></div>)}
      </dl></Card>}
      {!!customer.typed_notes?.trim() && <section aria-label="Customer notes"><h2 className="font-serif text-2xl mb-2">Notes</h2><Card className="p-4 sm:p-5"><p className="whitespace-pre-wrap break-words leading-relaxed">{customer.typed_notes}</p></Card></section>}
      {notes.map((row) => <section key={row.user_id} aria-label={row.user_id === userId ? "My customer notes" : "Team member additions"}>
        <h2 className="font-serif text-2xl mb-2 break-words">{row.user_id === userId ? "My notes" : members.find((member) => member.user_id === row.user_id)?.email ?? "Team member notes"}</h2>
        <Card className="p-4 sm:p-5 space-y-3">
          {!!row.notes.trim() && <p className="whitespace-pre-wrap break-words leading-relaxed">{row.notes}</p>}
          {row.wants.length > 0 && <div><h3 className="text-sm text-muted-foreground mb-1">Wants</h3><p className="break-words">{row.wants.join(" · ")}</p></div>}
        </Card>
      </section>)}
      {drawings.length > 0 && <section aria-label="Drawings"><h2 className="font-serif text-2xl mb-2">Drawings</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {drawings.map((drawing) => <Card key={drawing.id} className="p-3 space-y-3">
          {drawing.url ? <a href={drawing.url} target="_blank" rel="noopener noreferrer" aria-label="Open drawing"><img src={drawing.url} alt={`Drawing for ${customer.name}`} className="w-full max-h-96 object-contain rounded bg-white" /></a> : <p className="text-sm text-muted-foreground">Drawing preview unavailable</p>}
          {drawing.ocr_text && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{drawing.ocr_text}</p>}
        </Card>)}
      </div></section>}
      {photos.length > 0 && <section aria-label="Photos"><h2 className="font-serif text-2xl mb-2">Photos</h2><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => <Card key={photo.id} className="p-2">{photo.url ? <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label="Open photo"><img src={photo.url} alt={`Photo for ${customer.name}`} className="w-full aspect-square object-contain rounded" /></a> : <p className="text-sm text-muted-foreground">Photo preview unavailable</p>}</Card>)}
      </div></section>}
      {!hasContent && <p className="text-sm text-muted-foreground">No additional information yet.</p>}
    </div>
  );
}
