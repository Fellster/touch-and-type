import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) {
    const next = loc.pathname + loc.search;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}
