import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Shield, Radio, Sparkles, Check, ArrowRight, Lock, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import type { AppRole } from "@/lib/kable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In & RBAC Access — KableHero" },
      {
        name: "description",
        content: "Sign in with Role-Based Access Control for Citizens, Dispatchers, and Barangay Tanods.",
      },
    ],
  }),
  component: AuthPage,
});

const ROLE_OPTIONS: {
  role: AppRole;
  title: string;
  badge: string;
  icon: typeof Users;
  desc: string;
  accentClass: string;
}[] = [
  {
    role: "citizen",
    title: "Citizen Reporter",
    badge: "Default",
    icon: Users,
    desc: "Spot & report downed lines, earn civic XP, and redeem power bill rebates.",
    accentClass: "text-amber-700 bg-amber-100",
  },
  {
    role: "dispatcher",
    title: "Co-op Dispatcher",
    badge: "BUSECO Ops",
    icon: Radio,
    desc: "Triage priority hazard clusters, assign lineman crews, and resolve tickets.",
    accentClass: "text-blue-700 bg-blue-100",
  },
  {
    role: "tanod",
    title: "Barangay Tanod",
    badge: "Field Safety",
    icon: Shield,
    desc: "Physically verify reported hazards on patrol and confirm clearance.",
    accentClass: "text-emerald-700 bg-emerald-100",
  },
];

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("citizen");
  const [busy, setBusy] = useState(false);

  const { user, profile, role: currentRole, refreshProfile } = useAuth();
  const { setRole } = useRole();
  const navigate = useNavigate();

  // Redirect to role view if already authenticated
  useEffect(() => {
    if (user && profile) {
      const targetRole = profile.role || currentRole || "citizen";
      setRole(targetRole);
      if (targetRole === "dispatcher") {
        void navigate({ to: "/map" });
      } else if (targetRole === "tanod") {
        void navigate({ to: "/verify" });
      } else {
        void navigate({ to: "/" });
      }
    }
  }, [user, profile, currentRole, navigate, setRole]);

  const redirectForRole = (role: AppRole) => {
    setRole(role);
    if (role === "dispatcher") {
      void navigate({ to: "/map" });
    } else if (role === "tanod") {
      void navigate({ to: "/verify" });
    } else {
      void navigate({ to: "/" });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: selectedRole,
              display_name: displayName.trim() || email.split("@")[0],
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        // Try direct upsert into profiles if user is immediately confirmed
        if (data.user) {
          try {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              display_name: displayName.trim() || email.split("@")[0] || "Kabayan",
              role: selectedRole,
              xp_total: 0,
            });
          } catch (profileErr) {
            console.warn("Profile trigger or RLS handled insertion:", profileErr);
          }
        }

        toast.success(`Account registered as ${selectedRole.toUpperCase()}! Welcome to KableHero.`);
        redirectForRole(selectedRole);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Fetch user's assigned role from database
        let userRole: AppRole = "citizen";
        if (data.user) {
          const { data: p } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", data.user.id)
            .maybeSingle();

          if (p?.role) {
            userRole = p.role as AppRole;
          } else if (data.user.user_metadata?.role) {
            userRole = data.user.user_metadata.role as AppRole;
          }
        }

        await refreshProfile();
        toast.success(`Welcome back, ${data.user?.email}! Signed in as ${userRole.toUpperCase()}.`);
        redirectForRole(userRole);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    redirectForRole("citizen");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {/* Claymorphism Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 clay-pill bg-amber-100 text-amber-900 px-3 py-1 text-xs">
            <Sparkles className="size-3.5 text-amber-700" />
            <span>Role-Based Safety Authentication</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-slate-900 mt-2">
            {mode === "signin" ? "Sign In to KableHero" : "Create Verified Account"}
          </h1>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            {mode === "signin"
              ? "Access your assigned role dispatch, verification logs, or citizen reward points."
              : "Select your community role to route directly to your designated operational workflow."}
          </p>
        </div>

        {/* Mode Selector Segmented Clay Switch */}
        <div className="clay-card p-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 py-2.5 rounded-xl font-display text-xs tracking-wider uppercase font-bold transition-all ${
              mode === "signin"
                ? "clay-btn-primary shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 py-2.5 rounded-xl font-display text-xs tracking-wider uppercase font-bold transition-all ${
              mode === "signup"
                ? "clay-btn-primary shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Register Role
          </button>
        </div>

        {/* Main Clay Card Form */}
        <form onSubmit={submit} className="clay-card p-5 sm:p-6 space-y-4">
          {/* Role Picker (Visible during Signup) */}
          {mode === "signup" && (
            <div className="space-y-2">
              <label className="label-caps block text-slate-700">
                Assign System Role (RBAC)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ROLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedRole === opt.role;
                  return (
                    <button
                      key={opt.role}
                      type="button"
                      onClick={() => setSelectedRole(opt.role)}
                      className={`clay-card p-3 text-left transition-all relative ${
                        isSelected
                          ? "ring-2 ring-amber-500 scale-[1.02] bg-amber-50/70"
                          : "opacity-80 hover:opacity-100"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-amber-500 text-white">
                          <Check className="size-2.5 stroke-[3]" />
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Icon className="size-4 text-slate-800" />
                        <span className="font-display text-xs font-bold uppercase text-slate-900">
                          {opt.title}
                        </span>
                      </div>
                      <span className={`clay-pill inline-block mt-1 px-1.5 py-0.5 text-[9px] uppercase font-bold ${opt.accentClass}`}>
                        {opt.badge}
                      </span>
                      <p className="mt-1 text-[10px] text-slate-600 leading-tight">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Display Name (during Signup) */}
          {mode === "signup" && (
            <div>
              <label className="label-caps block text-slate-700" htmlFor="displayName">
                Display Name / Call Sign
              </label>
              <div className="relative mt-1">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <input
                  id="displayName"
                  type="text"
                  placeholder="e.g. Lineman Santos / Juan (Purok 2)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="clay-input w-full pl-10 pr-3 py-2.5 text-sm"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="label-caps block text-slate-700" htmlFor="email">
              Email Address
            </label>
            <div className="relative mt-1">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                id="email"
                type="email"
                required
                placeholder="name@coop.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="clay-input w-full pl-10 pr-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="label-caps block text-slate-700" htmlFor="password">
              Password
            </label>
            <div className="relative mt-1">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="clay-input w-full pl-10 pr-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy}
            className="clay-btn clay-btn-primary w-full py-3.5 text-sm tracking-widest uppercase font-bold"
          >
            {busy ? (
              "Authenticating…"
            ) : mode === "signin" ? (
              "Sign In & Launch Console"
            ) : (
              `Create ${selectedRole.toUpperCase()} Account`
            )}
            <ArrowRight className="ml-2 size-4" />
          </button>
        </form>

        {/* OAuth Social Fallback */}
        <button
          onClick={google}
          className="clay-btn clay-btn-neutral w-full py-3 text-xs tracking-wider uppercase font-bold text-slate-700"
        >
          Continue with Google OAuth
        </button>

        {/* Role Routing Explanation Banner */}
        <div className="clay-card-amber p-4 space-y-2 text-xs text-amber-950">
          <p className="font-bold flex items-center gap-1.5 text-amber-900 uppercase tracking-wide">
            <Radio className="size-4 text-amber-700" />
            Automatic Post-Login Role Routing
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-amber-200">
            <div>
              <strong className="text-amber-950">Citizen:</strong>
              <p className="text-amber-900/80">Directed to 3-tap Reporter flow</p>
            </div>
            <div>
              <strong className="text-amber-950">Dispatcher:</strong>
              <p className="text-amber-900/80">Directed to BUSECO Triage map</p>
            </div>
            <div>
              <strong className="text-amber-950">Tanod:</strong>
              <p className="text-amber-900/80">Directed to Field verification queue</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
