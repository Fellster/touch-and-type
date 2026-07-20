import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import VoiceCapture, { type ParsedResult } from "@/components/VoiceCapture";
import { toast } from "sonner";

const HIDE_ON = ["/auth", "/.lovable/oauth/consent", "/preview"];

export default function FloatingMic() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  if (!user) return null;
  if (HIDE_ON.some((p) => loc.pathname.startsWith(p))) return null;

  const handle = async (r: ParsedResult) => {
    const t = r.transcript.toLowerCase().trim();

    // Smart open commands
    if (/^(new|add|create)\s+customer\b/.test(t) && !r.customer?.name) {
      nav("/customers?add=1");
      return;
    }
    if (/^(new|add|create)\s+(task|todo|to.?do)\b/.test(t) && !r.todo?.title) {
      // no fields parsed — just focus the todo input on home
      nav("/");
      return;
    }

    if (r.intent === "todo" && r.todo?.title) {
      if (!user) return;
      const { error } = await supabase.from("todos").insert({
        user_id: user.id,
        title: r.todo.title,
        due_at: r.todo.due_at,
      });
      if (error) return toast.error(error.message);
      toast.success("To-do added");
      nav("/");
      return;
    }

    if (r.intent === "customer" && r.customer?.name) {
      const c = r.customer;
      const { data, error } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          name: c.name!,
          phone: c.phone,
          email: c.email,
          designers: c.designers ?? [],
          looking_for: c.looking_for ?? [],
          shoe_size: c.shoe_size,
          width: c.width,
          typed_notes: c.notes,
        })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      toast.success("Customer added");
      nav(`/c/${data.id}`);
      return;
    }

    toast.info("Nothing to save — try again or edit in the form.");
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <VoiceCapture
        context="global"
        onCommit={handle}
        variant="default"
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        title="Voice command"
      />
    </div>
  );
}
