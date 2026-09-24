import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
      { title: "Your civic profile — KableHero Lite" },
      {
        name: "description",
        content: "Track your XP, civic tier and hazard reporting history as a Purok Scout, Tanod Specialist or Master Lineman.",
      },
      { property: "og:title", content: "Your civic profile — KableHero Lite" },
      {
        property: "og:description",
        content: "XP, civic tier and hazard reporting history in KableHero Lite.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, signOut } = useAuth();

  const { data: myReports = [] } = useQuery({
    queryKey: ["my-reports", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("id, hazard_tier, status, verification_count, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as {
        id: string;
        hazard_tier: HazardTier;
        status: ReportStatus;
        verification_count: number;
        created_at: string;
      }[];
    },
  });

  const { data: voteCount = 0 } = useQuery({
    queryKey: ["my-vote-count", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { count } = await supabase
        .from("validations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  if (!user || !profile) {
    return (
      <AppShell>
        <div className="px-4 py-10 text-center">
          <h1 className="text-2xl font-semibold uppercase">No profile yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to start earning XP for hazard reports and validations.
          </p>
          <Link
            to="/auth"
            className="mt-5 inline-block rounded-md bg-primary px-5 py-3 font-display tracking-widest text-primary-foreground uppercase"
          >
            Sign in
          </Link>
        </div>
      </AppShell>
    );
  }

  const tier = civicTier(profile.xp_total);

  return (
    <AppShell>
      <div className="space-y-5 px-4 py-5">
        <section className="panel p-5">
          <p className="label-caps">Civic tier</p>
          <h1 className="mt-1 text-3xl font-semibold text-primary uppercase">{tier.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.display_name} · {profile.xp_total} XP
            {roles.length > 0 && ` · ${roles.join(", ")}`}
          </p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${tier.progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {tier.next ? `${tier.nextAt! - profile.xp_total} XP to ${tier.next}` : "Top tier reached"}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Stat label="Reports filed" value={myReports.length} hint={`+${XP_REPORT} XP each`} />
          <Stat label="Validations" value={voteCount} hint={`+${XP_VALIDATION} XP each`} />
        </section>

        <section className="panel p-4">
          <p className="label-caps">Badge ladder</p>
          <ul className="mt-3 space-y-2">
            {CIVIC_TIERS.map((t) => (
              <li key={t.name} className="flex items-center justify-between text-sm">
                <span className={profile.xp_total >= t.min ? "text-foreground" : "text-muted-foreground"}>
                  {t.name}
                </span>
                <span className="font-display text-xs tracking-widest text-muted-foreground uppercase">
                  {profile.xp_total >= t.min ? "Unlocked" : `${t.min} XP`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="label-caps">Your reports</p>
          <div className="mt-2 space-y-2">
            {myReports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: TIER_COLOR[r.hazard_tier] }} />
                <span className="flex-1 text-sm">
                  <span className="block font-display tracking-wide uppercase">
                    {r.hazard_tier} · {STATUS_LABEL[r.status]}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {timeAgo(r.created_at)} · {r.verification_count} confirmations
                  </span>
                </span>
              </div>
            ))}
            {myReports.length === 0 && (
              <p className="text-sm text-muted-foreground">No reports yet — your first one earns 50 XP.</p>
            )}
          </div>
        </section>

        <button
          onClick={() => void signOut()}
          className="w-full rounded-md border border-border py-3 font-display tracking-widest uppercase"
        >
          Sign out
        </button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="panel p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-display text-3xl text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
