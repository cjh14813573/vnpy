import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMarketStore } from '../stores/marketStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const token = useAuthStore((s) => s.token);
  const updateTick = useMarketStore((s) => s.updateTick);

  console.log('[AuthGuard] isLoggedIn:', isLoggedIn, 'token exists:', !!token);

  useWebSocket(isLoggedIn ? { tick: updateTick } : undefined);

  if (!isLoggedIn) {
    console.log('[AuthGuard] Not logged in, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
