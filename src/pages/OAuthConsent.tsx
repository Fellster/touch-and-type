import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";

// Local typing wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Failed to load authorization");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("No redirect returned by the authorization server.");
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Authorization failed");
    }
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an application";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <SEO title="Authorize connection — Atelier" description="Approve or deny a connection to your Atelier account." path="/.lovable/oauth/consent" noindex />
      <Card className="w-full max-w-md p-8 shadow-sm">
        {error ? (
          <div>
            <h1 className="font-serif text-2xl mb-2">Couldn't load this request</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : !details ? (
          <p className="text-center text-muted-foreground">Loading authorization…</p>
        ) : (
          <div className="space-y-5">
            <header>
              <h1 className="font-serif text-2xl">Connect {clientName} to Atelier</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {clientName} will be able to call Atelier's tools while you are signed in — read and update your
                to-do list and customer notebook as you.
              </p>
            </header>
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Share:</span> your basic profile and email</p>
              <p className="text-muted-foreground text-xs">
                This does not bypass Atelier's per-account permissions.
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => decide(true)} disabled={busy}>
                {busy ? "Please wait…" : "Approve"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => decide(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
