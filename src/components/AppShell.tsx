import { Link, useRouterState } from "@tanstack/react-router";
import { Zap, MapPinned, CircleUser, Radio, Shield, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { civicTier } from "@/lib/kable";

const NAV = [
  { to: "/", label: "Report", icon: Zap },
  { to: "/map", label: "Triage map", icon: MapPinned },
  { to: "/profile", label: "Profile & Rewards", icon: CircleUser },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const { role, setRole, isAdmin } = useRole();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <div
      className={`mx-auto flex min-h-screen flex-col bg-background transition-all duration-200 ${
        isAdmin ? "w-full max-w-7xl px-2 sm:px-6" : "w-full max-w-lg"
      }`}
    >
      {/* Top Header with Dual-Role Switcher */}
      <header className="sticky top-0 z-[500] border-b border-border bg-background/95 backdrop-blur px-3 sm:px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span
              className={`flex size-8 items-center justify-center rounded-md ${
                isAdmin ? "bg-amber-500 text-slate-950 font-bold" : "bg-primary text-primary-foreground"
              }`}
            >
              {isAdmin ? <Shield className="size-4" /> : <Radio className="size-4" />}
            </span>
            <span className="font-display text-base sm:text-lg leading-none font-semibold tracking-wide uppercase">
              KableHero <span className={isAdmin ? "text-amber-400" : "text-primary"}>{isAdmin ? "Ops" : "Lite"}</span>
            </span>
          </Link>

          {/* Top-Level Role Toggle for Live Pitch Demonstrations */}
          <div className="flex items-center rounded-full border border-border bg-surface p-0.5 text-xs">
            <button
              onClick={() => setRole("citizen")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-display tracking-wider uppercase transition-colors ${
                !isAdmin
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3" />
              <span className="hidden xs:inline">Citizen</span>
            </button>

            <button
              onClick={() => setRole("admin")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-display tracking-wider uppercase transition-colors ${
                isAdmin
                  ? "bg-amber-500 text-slate-950 font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="size-3" />
              <span className="hidden xs:inline">Admin</span> (BUSECO)
            </button>
          </div>

          {/* Profile / XP or Sign In */}
          <div className="flex items-center gap-2">
            {user && profile ? (
              <Link to="/profile" className="text-right hover:opacity-80">
                <p className="font-display text-[10px] tracking-wider text-muted-foreground uppercase">
                  {civicTier(profile.xp_total).name}
                </p>
                <p className="font-display text-xs sm:text-sm font-bold text-primary">
                  {profile.xp_total} XP
                </p>
              </Link>
            ) : (
              <Link
                to="/auth"
                className="rounded-md border border-border px-2.5 py-1 font-display text-xs tracking-wide uppercase hover:bg-muted"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Citizen Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-1/2 z-[500] w-full max-w-lg -translate-x-1/2 border-t border-border bg-background/95 backdrop-blur">
        <div className="grid grid-cols-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "text-primary font-semibold" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
              className="flex flex-col items-center gap-1 py-2.5"
            >
              <Icon className="size-5" />
              <span className="font-display text-[11px] tracking-widest uppercase">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
