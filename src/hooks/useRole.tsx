import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export type RoleMode = "citizen" | "admin";

interface RoleContextType {
  role: RoleMode;
  setRole: (role: RoleMode) => void;
  toggleRole: () => void;
  isAdmin: boolean;
  isCitizen: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

const STORAGE_KEY = "kablehero_active_role_mode";

export function RoleProvider({ children }: { children: ReactNode }) {
  const { roles } = useAuth();
  const [role, setRoleState] = useState<RoleMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "admin" || saved === "citizen") return saved;
    }
    return "citizen";
  });

  // If user actually has dispatcher or tanod role in Supabase and no manual preference set
  useEffect(() => {
    if (roles.includes("dispatcher") || roles.includes("tanod")) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setRoleState("admin");
      }
    }
  }, [roles]);

  const setRole = (newRole: RoleMode) => {
    setRoleState(newRole);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newRole);
    }
  };

  const toggleRole = () => {
    const next = role === "citizen" ? "admin" : "citizen";
    setRole(next);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        toggleRole,
        isAdmin: role === "admin",
        isCitizen: role === "citizen",
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
