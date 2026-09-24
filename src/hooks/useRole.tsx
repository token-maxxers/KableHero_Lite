import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/kable";

export type { AppRole };

interface RoleContextType {
  role: AppRole;
  setRole: (role: AppRole) => void;
  isCitizen: boolean;
  isDispatcher: boolean;
  isTanod: boolean;
  isAdmin: boolean; // Backwards compatible with existing admin checks (= isDispatcher)
  roleTitle: string;
}

const RoleContext = createContext<RoleContextType | null>(null);

const STORAGE_KEY = "kablehero_active_role_mode";

export function RoleProvider({ children }: { children: ReactNode }) {
  const { role: authRole, user } = useAuth();

  const [role, setRoleState] = useState<AppRole>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as AppRole;
      if (saved === "citizen" || saved === "dispatcher" || saved === "tanod") return saved;
    }
    return authRole || "citizen";
  });

  // Whenever authRole updates from Supabase, update current role if user is signed in
  useEffect(() => {
    if (user && authRole) {
      setRoleState(authRole);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, authRole);
      }
    }
  }, [user, authRole]);

  const setRole = (newRole: AppRole) => {
    setRoleState(newRole);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newRole);
    }
  };

  const roleTitle =
    role === "dispatcher"
      ? "Dispatcher (BUSECO Ops)"
      : role === "tanod"
      ? "Tanod (Barangay Safety)"
      : "Citizen Reporter";

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        isCitizen: role === "citizen",
        isDispatcher: role === "dispatcher",
        isTanod: role === "tanod",
        isAdmin: role === "dispatcher",
        roleTitle,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return ctx;
}
