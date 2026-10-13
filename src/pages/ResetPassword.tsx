import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkState, setLinkState] = useState<"checking" | "ready" | "invalid" | "error">("checking");

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (active) setLinkState(error ? "error" : data.session ? "ready" : "invalid");
      } catch {
        if (active) setLinkState("error");
      }
    };
    void checkSession();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linkState !== "ready") return;

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setBusy(false);
      if (error.name === "AuthSessionMissingError" || error.code === "session_not_found" || error.code === "refresh_token_not_found") {
        setLinkState("invalid");
        setPassword("");
        setConfirmPassword("");
        return;
      }
      toast.error(error.message);
      return;
    }

    await supabase.auth.signOut();

    toast.success("Password changed. Please sign in with your new password.");
    navigate("/auth");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        {linkState !== "ready" ? (
          <div role="status" aria-live="polite">
            <h1 className="text-2xl font-semibold">Reset password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {linkState === "checking" ? "Checking your reset link…" : linkState === "error" ? "We couldn’t check your reset link. Please try again or request a new one." : "This reset link is invalid or expired. Request a new one."}
            </p>
            {linkState !== "checking" && (
              <Button className="mt-6 w-full" onClick={() => navigate("/forgot-password")}>
                Request a new reset email
              </Button>
            )}
          </div>
        ) : (
        <>
        <h1 className="text-2xl font-semibold">Choose a new password</h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Enter your new Noted password below.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password">New password</Label>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-16"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 text-sm text-muted-foreground hover:text-foreground"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>

            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Changing password…" : "Change password"}
          </Button>
        </form>
        </>
        )}
      </Card>
    </main>
  );
}
