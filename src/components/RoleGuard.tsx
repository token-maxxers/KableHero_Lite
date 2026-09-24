import React, { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowRight, ShieldCheck, User } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/kable";
import { AppShell } from "@/components/AppShell";

interface RoleGuardProps {
  allowedRoles: AppRole[];
  requiredTitle: string;
  children: ReactNode;
}

export function RoleGuard({ allowedRoles, requiredTitle, children }: RoleGuardProps) {
  const { role, setRole, roleTitle } = useRole();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <div className="clay-card flex flex-col items-center gap-3 p-8 text-center">
            <div className="size-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
            <p className="font-display text-sm tracking-wider uppercase text-slate-700 font-bold">
              Verifying Security Credentials…
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const isAllowed = allowedRoles.includes(role);

  if (!isAllowed) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-8">
          <div className="clay-card p-6 text-center space-y-4">
            <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 shadow-inner">
              <ShieldAlert className="size-8" />
            </div>

            <div>
              <span className="clay-pill bg-amber-50 px-3 py-1 text-xs text-amber-800 uppercase tracking-wider">
                Restricted Clearance
              </span>
              <h1 className="mt-3 text-2xl font-bold uppercase tracking-tight text-slate-900">
                {requiredTitle} Only
              </h1>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                You do not have access to this screen with your current role (<strong>{roleTitle}</strong>).
                Citizens cannot view cooperative operations or tanod verifications directly.
              </p>
            </div>

            <div className="clay-card-amber p-4 text-left text-xs text-amber-950 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-amber-900">
                <ShieldCheck className="size-4 text-amber-700 shrink-0" />
                Assigned Role Destinations:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900/90 pl-1 font-medium">
                <li><strong>Citizen:</strong> Reporter flow & Community safety alerts</li>
                <li><strong>Dispatcher:</strong> BUSECO Incident triage & crew dispatch</li>
                <li><strong>Tanod:</strong> Barangay on-site hazard verification</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                to={role === "tanod" ? "/verify" : role === "dispatcher" ? "/map" : "/"}
                className="clay-btn clay-btn-primary w-full py-3 text-sm tracking-wider uppercase"
              >
                Go to My Assigned View
                <ArrowRight className="ml-1.5 size-4" />
              </Link>

              {!user ? (
                <Link
                  to="/auth"
                  className="clay-btn clay-btn-neutral w-full py-2.5 text-xs tracking-wider uppercase"
                >
                  <User className="mr-1.5 size-4 text-slate-600" />
                  Sign In with Authorized Account
                </Link>
              ) : (
                /* Demo helper to quickly switch roles in preview mode */
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] text-slate-500 font-semibold mb-1.5 uppercase tracking-wider">
                    Demo Mode: Switch Role Preview
                  </p>
                  <div className="flex gap-1.5 justify-center">
                    {allowedRoles.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRole(r)}
                        className="clay-btn clay-btn-neutral px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold"
                      >
                        Switch to {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
