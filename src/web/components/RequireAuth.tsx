import { Navigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';

/**
 * Gate that resolves the current session before rendering children.
 * - While loading: shows a tiny inline loader (avoids login flicker).
 * - On 401 / no session: redirects to /login.
 * - Otherwise: renders children.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-neutral-500 dark:text-neutral-400">
        Loading…
      </div>
    );
  }

  if (!data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
