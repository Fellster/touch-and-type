import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold">Reset your password</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email address you use for Noted. We’ll send you a secure
          password reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-md border bg-muted/40 p-4 text-sm">
            <p className="font-medium">Check your email.</p>
            <p className="mt-1 text-muted-foreground">
              The password reset email will come from Supabase, our secure
              account provider.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <Link
          to="/auth"
          className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground transition"
        >
          Back to sign in
        </Link>
      </Card>
    </main>
  );
}
