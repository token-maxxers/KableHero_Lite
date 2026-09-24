import { Link } from "@tanstack/react-router";
import { Zap, MapPinned, CircleUser, Radio } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { civicTier } from "@/lib/kable";

const NAV = [
  { to: "/", label: "Report", icon: Zap },
  { to: "/map", label: "Triage map", icon: MapPinned },
  { to: "/profile", label: "Profile", icon: CircleUser },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-[500] flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary">
            <Radio className="size-4 text-primary-foreground" />
          </span>
          <span className="font-display text-lg leading-none font-semibold tracking-wide uppercase">
            KableHero <span className="text-primary">Lite</span>
          </span>
        </Link>
        {user && profile ? (
          <div className="text-right">
            <p className="font-display text-xs tracking-wider text-muted-foreground uppercase">
              {civicTier(profile.xp_total).name}
            </p>
            <p className="font-display text-sm text-primary">{profile.xp_total} XP</p>
          </div>
        ) : (
          <Link
            to="/auth"
            className="rounded-md border border-border px-3 py-1.5 font-display text-sm tracking-wide uppercase"
          >
            Sign in
          </Link>
        )}
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-1/2 z-[500] w-full max-w-md -translate-x-1/2 border-t border-border bg-background/95 backdrop-blur">
        <div className="grid grid-cols-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "text-primary" }}
              inactiveProps={{ className: "text-muted-foreground" }}
              className="flex flex-col items-center gap-1 py-3"
            >
              <Icon className="size-5" />
              <span className="font-display text-xs tracking-widest uppercase">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
