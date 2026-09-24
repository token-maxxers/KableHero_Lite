import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSignedPhoto } from "@/lib/photo";
import {
  HAZARD_TIERS,
  STATUS_FLOW,
  STATUS_LABEL,
  TIER_COLOR,
  XP_VALIDATION,
  timeAgo,
  type HazardTier,
  type ReportStatus,
} from "@/lib/kable";

const HazardMap = lazy(() => import("@/components/HazardMap"));

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Triage map — KableHero Lite" },
      {
        name: "description",
        content:
          "Live map of reported electric hazards with tier colors, community verification counts and dispatcher status updates.",
      },
      { property: "og:title", content: "Triage map — KableHero Lite" },
      {
        property: "og:description",
        content: "Live electric hazard triage map for cooperatives and barangay responders.",
      },
    ],
  }),
  component: MapPage,
});

type Report = {
  id: string;
  lat: number;
  lng: number;
  hazard_tier: HazardTier;
  status: ReportStatus;
  verification_count: number;
  photo_url: string | null;
  created_at: string;
  user_id: string;
};

function MapPage() {
  const { user, roles, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<HazardTier | "all">("all");
  const [mounted, setMounted] = useState(false);
  const isDispatcher = roles.includes("dispatcher") || roles.includes("tanod");

  useEffect(() => setMounted(true), []);

  const { data: reports = [] } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, lat, lng, hazard_tier, status, verification_count, photo_url, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Report[];
    },
  });

  const { data: myVotes = [] } = useQuery({
    queryKey: ["my-votes", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase.from("validations").select("report_id").eq("user_id", user!.id);
      return (data ?? []).map((v) => v.report_id);
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["reports"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const visible = useMemo(
    () => (filter === "all" ? reports : reports.filter((r) => r.hazard_tier === filter)),
    [reports, filter],
  );
  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const vote = async (reportId: string, voteType: "still_broken" | "resolved") => {
    if (!user) {
      toast.error("Sign in to validate reports.");
      return;
    }
    const { error } = await supabase
      .from("validations")
      .insert({ report_id: reportId, user_id: user.id, vote: voteType });
    if (error) {
      toast.error(error.code === "23505" ? "You already voted on this pin." : error.message);
      return;
    }
    toast.success(`Thanks for validating. +${XP_VALIDATION} XP`);
    await refreshProfile();
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
    void queryClient.invalidateQueries({ queryKey: ["my-votes", user.id] });
  };

  const setStatus = async (reportId: string, status: ReportStatus) => {
    const { error } = await supabase
      .from("reports")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", reportId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked ${STATUS_LABEL[status]}`);
    void queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  return (
    <AppShell>
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold uppercase">Triage map</h1>
        <p className="text-sm text-muted-foreground">
          {reports.length} report{reports.length === 1 ? "" : "s"} · live updates
        </p>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          {HAZARD_TIERS.map((t) => (
            <FilterChip
              key={t.tier}
              active={filter === t.tier}
              onClick={() => setFilter(t.tier)}
              label={t.label}
              color={TIER_COLOR[t.tier]}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 h-[52vh] w-full border-y border-border">
        {mounted ? (
          <Suspense fallback={<div className="size-full bg-muted" />}>
            <HazardMap
              reports={visible}
              selectedId={selectedId}
              onSelect={setSelectedId}
              className="size-full"
            />
          </Suspense>
        ) : (
          <div className="size-full bg-muted" />
        )}
      </div>

      <div className="space-y-3 px-4 py-4">
        {selected ? (
          <ReportCard
            report={selected}
            isDispatcher={isDispatcher}
            hasVoted={myVotes.includes(selected.id)}
            onVote={vote}
            onStatus={setStatus}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Tap a pin to see the photo, verification count and actions.
          </p>
        )}

        <p className="label-caps pt-2">Latest reports</p>
        {visible.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-3 text-left"
          >
            <span className="size-3 rounded-full" style={{ backgroundColor: TIER_COLOR[r.hazard_tier] }} />
            <span className="flex-1">
              <span className="block font-display text-sm tracking-wide uppercase">
                {r.hazard_tier} · {STATUS_LABEL[r.status]}
              </span>
              <span className="block text-xs text-muted-foreground">
                {timeAgo(r.created_at)} · {r.verification_count} confirmations
              </span>
            </span>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">No reports yet for this filter.</p>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 font-display text-xs tracking-widest uppercase"
      style={{
        borderColor: active ? (color ?? "var(--primary)") : "var(--border)",
        color: active ? (color ?? "var(--primary)") : "var(--muted-foreground)",
      }}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function ReportCard({
  report,
  isDispatcher,
  hasVoted,
  onVote,
  onStatus,
  onClose,
}: {
  report: Report;
  isDispatcher: boolean;
  hasVoted: boolean;
  onVote: (id: string, v: "still_broken" | "resolved") => void;
  onStatus: (id: string, s: ReportStatus) => void;
  onClose: () => void;
}) {
  const photo = useSignedPhoto(report.photo_url);

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between">
        <div>
          <p
            className="font-display text-lg tracking-wide uppercase"
            style={{ color: TIER_COLOR[report.hazard_tier] }}
          >
            {report.hazard_tier} hazard
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo(report.created_at)} · {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
          </p>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground underline">
          Close
        </button>
      </div>

      {photo && (
        <img src={photo} alt="Reported hazard" className="mt-3 h-44 w-full rounded-lg object-cover" />
      )}

      <div className="mt-3 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-accent" />
          {report.verification_count} confirmations
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 font-display text-xs tracking-widest uppercase">
          {STATUS_LABEL[report.status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          disabled={hasVoted}
          onClick={() => onVote(report.id, "still_broken")}
          className="flex items-center justify-center gap-2 rounded-md border border-border py-3 font-display text-sm tracking-widest uppercase disabled:opacity-40"
        >
          <AlertTriangle className="size-4" /> Still broken
        </button>
        <button
          disabled={hasVoted}
          onClick={() => onVote(report.id, "resolved")}
          className="flex items-center justify-center gap-2 rounded-md border border-border py-3 font-display text-sm tracking-widest uppercase disabled:opacity-40"
        >
          <CheckCircle2 className="size-4" /> Resolved
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {hasVoted ? "You already validated this pin." : `Validating earns +${XP_VALIDATION} XP.`}
      </p>

      {isDispatcher && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="label-caps">Dispatcher · set status</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {STATUS_FLOW.map((s) => (
              <button
                key={s}
                onClick={() => onStatus(report.id, s)}
                className="rounded-md border border-border py-2 font-display text-xs tracking-widest uppercase"
                style={{
                  borderColor: report.status === s ? "var(--primary)" : "var(--border)",
                  color: report.status === s ? "var(--primary)" : "var(--foreground)",
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
