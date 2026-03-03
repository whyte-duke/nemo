"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const mapUser = useCallback(
    (supabaseUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): AuthUser | null => {
      if (!supabaseUser) return null;
      const meta = supabaseUser.user_metadata ?? {};
      const name =
        (meta.display_name as string | undefined) ??
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        supabaseUser.email?.split("@")[0] ??
        "Utilisateur";
      return { id: supabaseUser.id, name, email: supabaseUser.email ?? null };
    },
    []
  );

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();
    setUser(mapUser(supabaseUser));
    setLoading(false);
  }, [mapUser]);

  useEffect(() => {
    const supabase = createClient();

    // Charge la session initiale
    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(mapUser(u));
      setLoading(false);
    });

    // Écoute les changements en temps réel (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user ?? null));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [mapUser]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
