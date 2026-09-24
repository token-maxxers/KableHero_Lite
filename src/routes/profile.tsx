import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Award, Zap, Shield, Sparkles, CheckCircle, LogOut, Radio, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { RewardsMarketplace } from "@/components/RewardsMarketplace";
import {
  CIVIC_TIERS,
  STATUS_LABEL,
  TIER_COLOR,
  XP_REPORT,
  XP_VALIDATION,
  civicTier,
  timeAgo,
  type HazardTier,
  type ReportStatus,
} from "@/lib/kable";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Civic Profile & Rewards — KableHero" },
      {
        name: "description",
        content:
          "Track your XP, civic tier, safety badges and redeem electric bill discounts as a Purok Scout, Tanod Specialist, or Lineman Deputy.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, signOut, refreshProfile } = useAuth();
  const { role, roleTitle } = useRole();
  const [demoXpOffset, setDemoXpOffset] = useState(0);

  // Real or demo data
  const currentXp = (profile?.xp_total ?? 320) + demoXpOffset;
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Juan dela Cruz";
  const currentUserId = user?.id || "demo-citizen";

  const { data: myReports = [] } = useQuery({
    queryKey: ["my-reports", user?.id],
    queryFn: async () => {
      if (!user) {
        return [
          {
            id: "demo-r-1",
            hazard_tier: "critical" as HazardTier,
            status: "dispatched" as ReportStatus,
            verification_count: 7,
            created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
            landmark: "Near Yellow Sari-Sari Store, Sayre Hwy",
            pole_number: "BUSECO-MF-0412",
          },
          {
            id: "demo-r-2",
            hazard_tier: "urgent" as HazardTier,
            status: "resolved" as ReportStatus,
            verification_count: 4,
            created_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
            landmark: "Corner Fortich St Cathedral",
            pole_number: "BUSECO-MB-1092",
          },
        ];
      }

      const { data } = await supabase
        .from("reports")
        .select("id, hazard_tier, status, verification_count, created_at, note, landmark, pole_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return (data ?? []).map((r) => ({
        id: r.id,
        hazard_tier: r.hazard_tier as HazardTier,
        status: r.status as ReportStatus,
        verification_count: r.verification_count,
        created_at: r.created_at,
        landmark: r.landmark,
        pole_number: r.pole_number,
      }));
    },
  });

  const { data: voteCount = 5 } = useQuery({
    queryKey: ["my-vote-count", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return 5;
      const { count } = await supabase
        .from("validations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return count ?? 0;
    },
  });

  const tier = civicTier(currentXp);
  const hasPoleReport = myReports.some((r) => Boolean(r.pole_number));

  const handleXpChange = (newXp: number) => {
    setDemoXpOffset(newXp - (profile?.xp_total ?? 320));
  };

  return (
    <AppShell>
      <div className="space-y-4 px-4 py-4 max-w-lg mx-auto">
        {/* Guest Banner if not signed in */}
        {!user && (
          <div className="clay-card-amber p-4 flex items-center justify-between text-xs text-amber-950">
            <div>
              <span className="font-bold text-amber-950 block">Interactive Demo Profile</span>
              <p className="text-[11px] text-amber-900/80">
                Sign in with Supabase Auth to persist your roles and real XP.
              </p>
            </div>
            <Link
              to="/auth"
              className="clay-btn clay-btn-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Civic Rank Clay Banner */}
        <section className="clay-card-amber p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="clay-pill bg-amber-200/80 text-amber-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                  Civic Status
                </span>
                <span className="clay-pill bg-white text-slate-800 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                  {role.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-3xl">{tier.badge}</span>
                <h1 className="text-2xl font-bold uppercase tracking-tight text-amber-950 sm:text-3xl">
                  {tier.name}
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-amber-900/90 font-medium">{tier.description}</p>
            </div>

            <div className="text-right">
              <span className="font-display text-3xl font-extrabold text-amber-800">
                {currentXp}
              </span>
              <span className="block text-[10px] text-amber-900/70 font-mono uppercase font-bold">
                Total XP Earned
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
              <span>{displayName}</span>
              <span>{tier.next ? `${tier.nextAt! - currentXp} XP to ${tier.next}` : "Top Rank Reached"}</span>
            </div>
            {/* Puffy Clay Progress Bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-amber-200/80 shadow-inner p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300 shadow-sm"
                style={{ width: `${tier.progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-amber-900 font-semibold">
            <Shield className="size-3.5 text-amber-700" />
            <span>Active Role Clearance: {roleTitle}</span>
          </div>
        </section>

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-2 gap-3">
          <div className="clay-card p-4">
            <p className="label-caps text-slate-600">Reports Transmitted</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-slate-900">
              {myReports.length}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">+{XP_REPORT} XP per verified report</p>
          </div>
          <div className="clay-card p-4">
            <p className="label-caps text-slate-600">Field Validations</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-amber-600">{voteCount}</p>
            <p className="text-[10px] text-slate-500 font-medium">+{XP_VALIDATION} XP per vote</p>
          </div>
        </section>

        {/* Badges & Rewards Marketplace */}
        <RewardsMarketplace
          xp={currentXp}
          userName={displayName}
          userId={currentUserId}
          reportCount={myReports.length}
          voteCount={voteCount}
          hasPoleNumberReport={hasPoleReport}
          onXpChange={handleXpChange}
        />

        {/* My Reports History Clay List */}
        <section className="clay-card p-5 space-y-3">
          <p className="label-caps text-slate-700">Your Submitted Hazard Logs ({myReports.length})</p>
          <div className="space-y-2">
            {myReports.map((r) => (
              <div
                key={r.id}
                className="clay-card bg-slate-50/70 p-3.5 flex items-start gap-3 border border-slate-100"
              >
                <span
                  className="mt-1 size-3.5 shrink-0 rounded-full shadow-sm"
                  style={{ backgroundColor: TIER_COLOR[r.hazard_tier] }}
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold uppercase tracking-wide text-slate-900">
                      {r.landmark || `${r.hazard_tier} hazard`}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">{timeAgo(r.created_at)}</span>
                  </div>

                  {r.pole_number && (
                    <p className="text-[10px] font-mono text-amber-700 font-bold mt-0.5">
                      Pole Stencil: #{r.pole_number}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                    <span className="clay-pill bg-white px-2 py-0.5 font-display uppercase tracking-wider font-bold text-slate-800">
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span className="font-medium">{r.verification_count} field confirms</span>
                  </div>
                </div>
              </div>
            ))}
            {myReports.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4 font-medium">
                No reports submitted yet. Spotting a fallen wire earns 50 XP!
              </p>
            )}
          </div>
        </section>

        {/* Sign Out Button */}
        {user && (
          <button
            onClick={() => void signOut()}
            className="clay-btn clay-btn-neutral w-full py-3 text-xs tracking-widest uppercase font-bold text-slate-700 hover:text-red-600"
          >
            <LogOut className="mr-2 size-4" /> Sign Out from {user.email}
          </button>
        )}
      </div>
    </AppShell>
  );
}
