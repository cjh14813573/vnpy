import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMarketStore } from '../stores/marketStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const updateTick = useMarketStore((s) => s.updateTick);

  useWebSocket(isLoggedIn ? { tick: updateTick } : undefined);

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
