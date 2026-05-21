'use client';
import { useEffect } from 'react';
import { getSupabase } from '@web/lib/supabase/client';
import { useAuth } from '@/store/auth';
import { useSession } from '@/store/session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setInitialized } = useAuth();
  const { boot, reset } = useSession();

  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
      if (session) {
        boot().catch(() => {});
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        boot().catch(() => {});
      } else reset();
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
