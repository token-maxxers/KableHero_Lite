import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Award, Zap, Shield, Sparkles, CheckCircle, LogOut } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
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
      { property: "og:title", content: "Civic Profile & Rewards — KableHero" },
      {
        property: "og:description",
        content: "XP, safety badges, and BUSECO power rebate vouchers in KableHero.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, signOut, refreshProfile } = useAuth();
  const [demoXpOffset, setDemoXpOffset] = useState(0);

  // Real or demo data
  const currentXp = (profile?.xp_total ?? 320) + demoXpOffset;
  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Juan dela Cruz (Citizen)";
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
        .select("id, hazard_tier, status, verification_count, created_at, note")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return (data ?? []).map((r) => ({
        id: r.id,
        hazard_tier: r.hazard_tier as HazardTier,
        status: r.status as ReportStatus,
        verification_count: r.verification_count,
        created_at: r.created_at,
        landmark: null,
        pole_number: null,
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
      <div className="space-y-5 px-4 py-4">
        {/* Guest Banner if not signed in */}
        {!user && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs">
            <div>
              <span className="font-semibold text-foreground">Interactive Demo Profile</span>
              <p className="text-[11px] text-muted-foreground">
                Testing gamification rewards. Sign in anytime to sync to the cloud.
              </p>
            </div>
            <Link
              to="/auth"
              className="rounded bg-primary px-3 py-1 font-display text-xs font-bold text-primary-foreground uppercase"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Civic Rank Banner */}
        <section className="panel p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="label-caps">Civic Status Rank</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl">{tier.badge}</span>
                <h1 className="text-2xl font-bold uppercase tracking-tight text-primary sm:text-3xl">
                  {tier.name}
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{tier.description}</p>
            </div>

            <div className="text-right">
              <span className="font-display text-2xl font-bold text-primary sm:text-3xl">
                {currentXp}
              </span>
              <span className="block text-[10px] text-muted-foreground font-mono uppercase">
                Total XP Earned
              </span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{displayName}</span>
              <span>{tier.next ? `${tier.nextAt! - currentXp} XP to ${tier.next}` : "Top Rank Reached"}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${tier.progress}%` }}
              />
            </div>
          </div>

          {roles.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-accent">
              <Shield className="size-3.5" />
              <span>Assigned Roles: {roles.join(", ").toUpperCase()}</span>
            </div>
          )}
        </section>

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-2 gap-3">
          <div className="panel p-3.5">
            <p className="label-caps">Reports Filed</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {myReports.length}
            </p>
            <p className="text-[10px] text-muted-foreground">+{XP_REPORT} XP per verified report</p>
          </div>
          <div className="panel p-3.5">
            <p className="label-caps">Community Validations</p>
            <p className="mt-1 font-display text-2xl font-bold text-accent">{voteCount}</p>
            <p className="text-[10px] text-muted-foreground">+{XP_VALIDATION} XP per confirm vote</p>
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

        {/* My Reports History */}
        <section className="panel p-4 space-y-3">
          <p className="label-caps">Your Reported Hazards ({myReports.length})</p>
          <div className="space-y-2">
            {myReports.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-background/50 p-3"
              >
                <span
                  className="mt-1 size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: TIER_COLOR[r.hazard_tier] }}
                />
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold uppercase tracking-wide text-foreground">
                      {r.landmark || `${r.hazard_tier} hazard`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                  </div>

                  {r.pole_number && (
                    <p className="text-[10px] font-mono text-amber-300 font-medium">
                      Pole #{r.pole_number}
                    </p>
                  )}

                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.2 font-display uppercase tracking-wider">
                      {STATUS_LABEL[r.status]}
                    </span>
                    <span>{r.verification_count} confirmations</span>
                  </div>
                </div>
              </div>
            ))}
            {myReports.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No reports submitted yet. Spotting a fallen wire earns 50 XP!
              </p>
            )}
          </div>
        </section>

        {/* Sign Out if authenticated */}
        {user && (
          <button
            onClick={() => void signOut()}
            className="flex items-center justify-center gap-2 w-full rounded-md border border-border py-2.5 font-display text-xs tracking-widest uppercase hover:bg-muted text-muted-foreground"
          >
            <LogOut className="size-3.5" /> Sign Out
          </button>
        )}
      </div>
    </AppShell>
  );
}
