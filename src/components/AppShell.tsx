import { Link, useRouterState } from "@tanstack/react-router";
import { Zap, MapPinned, CircleUser, Radio, Shield, Users, ShieldCheck, ChevronDown } from "lucide-react";
import React, { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { civicTier, type AppRole } from "@/lib/kable";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const { role, setRole, isDispatcher, isTanod, isCitizen, roleTitle } = useRole();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  // Dynamic Navigation based on current user role
  const navItems = [
    ...(isCitizen
      ? [
          { to: "/", label: "Report", icon: Zap },
          { to: "/profile", label: "Profile & Rewards", icon: CircleUser },
        ]
      : isDispatcher
      ? [
          { to: "/map", label: "Triage Map", icon: MapPinned },
          { to: "/", label: "New Report", icon: Zap },
          { to: "/profile", label: "Console Profile", icon: CircleUser },
        ]
      : [
          { to: "/verify", label: "Verify Hazards", icon: ShieldCheck },
          { to: "/", label: "New Report", icon: Zap },
          { to: "/profile", label: "Tanod Profile", icon: CircleUser },
        ]),
  ] as const;

  return (
    <div
      className={`mx-auto flex min-h-screen flex-col bg-background transition-all duration-200 ${
        isDispatcher ? "w-full max-w-7xl px-2 sm:px-6" : "w-full max-w-lg"
      }`}
    >
      {/* Claymorphism Top Header */}
      <header className="sticky top-0 z-[500] px-3 sm:px-4 py-2.5 backdrop-blur-md bg-white/70 border-b border-white/60 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span
              className={`flex size-9 items-center justify-center rounded-2xl shadow-sm ${
                isDispatcher
                  ? "clay-btn-primary text-amber-950 font-bold"
                  : isTanod
                  ? "clay-btn-tanod text-emerald-950 font-bold"
                  : "clay-btn-primary text-amber-950"
              }`}
            >
              {isDispatcher ? (
                <Radio className="size-4" />
              ) : isTanod ? (
                <Shield className="size-4" />
              ) : (
                <Zap className="size-4" />
              )}
            </span>
            <span className="font-display text-base sm:text-lg leading-none font-bold tracking-wide uppercase text-slate-900">
              KableHero{" "}
              <span
                className={
                  isDispatcher
                    ? "text-amber-600"
                    : isTanod
                    ? "text-emerald-600"
                    : "text-amber-500"
                }
              >
                {isDispatcher ? "Ops" : isTanod ? "Tanod" : "Lite"}
              </span>
            </span>
          </Link>

          {/* Role Switcher Pill (Supports Fast Demo & Role Testing) */}
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className={`clay-pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                isDispatcher
                  ? "bg-amber-100 text-amber-900 border border-amber-300/80"
                  : isTanod
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300/80"
                  : "bg-slate-100 text-slate-800 border border-slate-300/80"
              }`}
              title="Switch Active Role Mode"
            >
              {isDispatcher ? (
                <Radio className="size-3 text-amber-700" />
              ) : isTanod ? (
                <Shield className="size-3 text-emerald-700" />
              ) : (
                <Users className="size-3 text-slate-600" />
              )}
              <span className="hidden sm:inline">{roleTitle}</span>
              <span className="sm:hidden">{role.toUpperCase()}</span>
              <ChevronDown className="size-3 opacity-70" />
            </button>

            {/* Role Switcher Dropdown */}
            {roleMenuOpen && (
              <div
                className="clay-card absolute right-0 mt-2 w-52 p-2 z-[600] space-y-1 shadow-xl bg-white border border-white"
                onClick={() => setRoleMenuOpen(false)}
              >
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1">
                  Active Role Clearance
                </p>
                {(
                  [
                    { r: "citizen", label: "Citizen Reporter", desc: "Report & earn vouchers" },
                    { r: "dispatcher", label: "BUSECO Dispatcher", desc: "Triage & dispatch crews" },
                    { r: "tanod", label: "Barangay Tanod", desc: "Field hazard verifier" },
                  ] as const
                ).map(({ r, label, desc }) => (
                  <button
                    key={r}
                    onClick={() => setRole(r as AppRole)}
                    className={`w-full text-left p-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                      role === r
                        ? "clay-btn-primary text-amber-950 font-extrabold"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div>{label}</div>
                    <div className="text-[9px] font-normal normal-case opacity-80">{desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Profile / XP or Sign In */}
          <div className="flex items-center gap-2">
            {user && profile ? (
              <Link to="/profile" className="text-right hover:opacity-85 transition-opacity">
                <p className="font-display text-[10px] tracking-wider text-slate-500 uppercase font-bold">
                  {civicTier(profile.xp_total).name}
                </p>
                <p className="font-display text-xs sm:text-sm font-extrabold text-amber-600">
                  {profile.xp_total} XP
                </p>
              </Link>
            ) : (
              <Link
                to="/auth"
                className="clay-btn clay-btn-neutral px-3 py-1 text-xs tracking-wider uppercase font-bold text-slate-800"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 pb-24">{children}</main>

      {/* Claymorphism Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-1/2 z-[500] w-full max-w-lg -translate-x-1/2 p-2 pointer-events-none">
        <div className="clay-card pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 border border-white/80 shadow-lg">
          <div className={`grid ${navItems.length === 3 ? "grid-cols-3" : "grid-cols-2"} gap-1`}>
            {navItems.map(({ to, label, icon: Icon }) => {
              const active =
                to === "/" ? currentPath === "/" : currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-all ${
                    active
                      ? "clay-btn-primary text-amber-950 font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="font-display text-[10px] tracking-wider uppercase font-bold">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
