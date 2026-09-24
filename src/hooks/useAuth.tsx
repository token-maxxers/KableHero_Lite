import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/kable";

export type Profile = {
  id: string;
  display_name: string;
  xp_total: number;
  role: AppRole;
};

type AuthState = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  role: AppRole;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (userId: string | undefined, userMetaRole?: string) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }

    try {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, xp_total, role").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      const inferredRole = (p?.role ||
        (userMetaRole as AppRole) ||
        (r?.[0]?.role as AppRole) ||
        "citizen") as AppRole;

      if (p) {
        setProfile({
          id: p.id,
          display_name: p.display_name || "Kabayan",
          xp_total: p.xp_total ?? 0,
          role: inferredRole,
        });
      } else {
        setProfile({
          id: userId,
          display_name: "Kabayan",
          xp_total: 0,
          role: inferredRole,
        });
      }

      const activeRoles = new Set<AppRole>();
      if (inferredRole) activeRoles.add(inferredRole);
      (r ?? []).forEach((row) => {
        if (row.role) activeRoles.add(row.role as AppRole);
      });
      if (activeRoles.size === 0) activeRoles.add("citizen");
      setRoles(Array.from(activeRoles));
    } catch (err) {
      console.warn("Could not load user profile/roles:", err);
      setRoles(["citizen"]);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      const metaRole = next?.user?.user_metadata?.role;
      setTimeout(() => void load(next?.user?.id, metaRole), 0);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const metaRole = data.session?.user?.user_metadata?.role;
      void load(data.session?.user?.id, metaRole).finally(() => setLoading(false));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const currentRole: AppRole = profile?.role || roles[0] || "citizen";

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    profile,
    roles,
    role: currentRole,
    loading,
    refreshProfile: () => load(session?.user?.id, session?.user?.user_metadata?.role),
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setRoles([]);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
