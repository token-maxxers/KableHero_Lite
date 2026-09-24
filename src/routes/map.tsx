import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  MapPin,
  Tag,
  Clock,
  Layers,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { AdminDispatchConsole } from "@/components/AdminDispatchConsole";
import {
  HAZARD_TIERS,
  STATUS_FLOW,
  STATUS_LABEL,
  TIER_COLOR,
  XP_VALIDATION,
  timeAgo,
  type HazardTier,
  type ReportStatus,
  type HazardReport,
} from "@/lib/kable";
import {
  fetchAllReports,
  verifyReport,
  updateReportStatus,
} from "@/lib/reports";
import HazardMap from "@/components/HazardMap";

import { RoleGuard } from "@/components/RoleGuard";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Triage Map & Operations — KableHero" },
      {
        name: "description",
        content:
          "Live map of reported electrical hazards with priority color-coding, community verification and BUSECO dispatch status updates.",
      },
      { property: "og:title", content: "Triage Map & Operations — KableHero" },
      {
        property: "og:description",
        content: "Live electric hazard triage map for Philippine communities and cooperatives.",
      },
    ],
  }),
  component: GuardedMapPage,
});

function GuardedMapPage() {
  return (
    <RoleGuard allowedRoles={["dispatcher"]} requiredTitle="BUSECO Dispatcher">
      <MapPage />
    </RoleGuard>
  );
}

function MapPage() {
  const { user, roles, refreshProfile } = useAuth();
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<HazardTier | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Fetch reports with fallback and seed support
  const { data: reports = [], refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      return await fetchAllReports();
    },
    refetchInterval: 12000, // Poll fallback
  });

  const { data: myVotes = [] } = useQuery({
    queryKey: ["my-votes", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("validations")
        .select("report_id")
        .eq("user_id", user!.id);
      return (data ?? []).map((v) => v.report_id);
    },
  });

  // Supabase Realtime channel subscription
  useEffect(() => {
    const channel = supabase
      .channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["reports"] });
      })
      .subscribe();

    const handleCustomUpdate = () => {
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    };

    window.addEventListener("kablehero_report_updated", handleCustomUpdate);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("kablehero_report_updated", handleCustomUpdate);
    };
  }, [queryClient]);

  // Citizen side filters
  const visible = useMemo(() => {
    return reports.filter((r) => {
      if (filter !== "all" && r.hazard_tier !== filter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [reports, filter, statusFilter]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  // Handle community verification vote
  const handleVote = async (reportId: string, voteType: "still_broken" | "resolved") => {
    const userId = user?.id || "demo-citizen";
    try {
      await verifyReport(reportId, userId, voteType);
      toast.success(
        voteType === "still_broken"
          ? `Confirmed "Still Broken". Hazard credibility elevated! +${XP_VALIDATION} XP`
          : `Flagged as "Resolved". Co-op notified! +${XP_VALIDATION} XP`
      );
      if (user) {
        await refreshProfile();
      }
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      void queryClient.invalidateQueries({ queryKey: ["my-votes", user?.id] });
    } catch {
      toast.error("Failed to submit verification");
    }
  };

  // If in Admin Console mode, display the full BUSECO operations console!
  if (isAdmin) {
    return (
      <AppShell>
        <AdminDispatchConsole reports={reports} onRefresh={() => refetch()} />
      </AppShell>
    );
  }

  // Otherwise, render Citizen Mobile View
  return (
    <AppShell>
      <div className="px-4 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight sm:text-2xl">
              Community Threat Map
            </h1>
            <p className="text-xs text-muted-foreground">
              {reports.length} reported electric hazards · Real-time synchronization
            </p>
          </div>
          <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary font-mono uppercase">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Live Sync
          </span>
        </div>

        {/* Tier filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
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

      {/* Leaflet Map Section */}
      <div className="mt-2 h-[50vh] w-full border-y border-border relative">
        {mounted ? (
          <HazardMap
            reports={visible.map((r) => ({
              id: r.id,
              lat: r.lat,
              lng: r.lng,
              hazard_tier: r.hazard_tier,
              status: r.status,
              verification_count: r.verification_count,
              landmark: r.landmark,
              pole_number: r.pole_number,
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="size-full"
          />
        ) : (
          <div className="size-full bg-muted" />
        )}
      </div>

      {/* Selected Report Card or Feed */}
      <div className="space-y-3 px-4 py-4">
        {selected ? (
          <CitizenReportCard
            report={selected}
            hasVoted={myVotes.includes(selected.id)}
            onVote={handleVote}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-md border border-border">
            💡 <strong>Tap any pin on the map</strong> to inspect the live hazard, view photo proof, and cast a "Still Broken" community confirmation.
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="label-caps">Latest Hazard Dispatches ({visible.length})</p>
          <span className="text-[11px] text-muted-foreground">Highest risk first</span>
        </div>

        <div className="space-y-2">
          {visible.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface/50 p-3 text-left hover:bg-muted/40 transition-colors"
            >
              <span
                className="mt-1 size-3 shrink-0 rounded-full"
                style={{ backgroundColor: TIER_COLOR[r.hazard_tier] }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-display text-sm font-semibold tracking-wide uppercase text-foreground">
                    {r.landmark || "Cooperative Line Segment"}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {timeAgo(r.created_at)}
                  </span>
                </div>

                {r.pole_number && (
                  <p className="text-[11px] font-mono text-amber-300 font-medium">
                    POLE: {r.pole_number}
                  </p>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                  <span
                    className="font-display font-bold uppercase tracking-wider"
                    style={{ color: TIER_COLOR[r.hazard_tier] }}
                  >
                    {r.hazard_tier}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.2 font-display uppercase tracking-wider text-muted-foreground">
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="flex items-center gap-1 text-accent font-semibold">
                    <ShieldCheck className="size-3" />
                    {r.verification_count} confirmations
                  </span>
                </div>
              </div>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="text-xs text-muted-foreground py-6 text-center">
              No electrical hazards reported in this category.
            </p>
          )}
        </div>
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
      className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 font-display text-[11px] tracking-wider uppercase transition-colors"
      style={{
        borderColor: active ? (color ?? "var(--primary)") : "var(--border)",
        backgroundColor: active ? (color ? `color-mix(in oklab, ${color} 20%, transparent)` : "var(--primary)") : "transparent",
        color: active ? (color ? "#ffffff" : "var(--primary-foreground)") : "var(--muted-foreground)",
      }}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function CitizenReportCard({
  report,
  hasVoted,
  onVote,
  onClose,
}: {
  report: HazardReport;
  hasVoted: boolean;
  onVote: (id: string, v: "still_broken" | "resolved") => void;
  onClose: () => void;
}) {
  return (
    <div className="panel p-4 space-y-3 border-primary/40 bg-surface">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: TIER_COLOR[report.hazard_tier] }}
            />
            <span
              className="font-display text-base font-bold tracking-wide uppercase"
              style={{ color: TIER_COLOR[report.hazard_tier] }}
            >
              {report.hazard_tier} electrical hazard
            </span>
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold uppercase text-foreground">
            {report.landmark || "Cooperative Electric Segment"}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono">
            {report.lat.toFixed(5)}, {report.lng.toFixed(5)} · Reported {timeAgo(report.created_at)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Close
        </button>
      </div>

      {/* Stenciled Pole & Tanod badge */}
      <div className="flex flex-wrap items-center gap-2">
        {report.pole_number && (
          <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-300 border border-amber-500/30">
            <Tag className="size-3" />
            POLE #{report.pole_number}
          </span>
        )}

        <span className="rounded bg-muted px-2 py-0.5 font-display text-xs tracking-wider uppercase font-semibold text-foreground">
          {STATUS_LABEL[report.status]}
        </span>

        {report.is_tanod_verified && (
          <span className="rounded bg-blue-500/20 px-2 py-0.5 font-display text-[10px] tracking-wider uppercase font-semibold text-blue-300">
            ✓ Barangay Tanod Verified
          </span>
        )}
      </div>

      {/* Photo proof */}
      {report.photo_url && (
        <img
          src={report.photo_url}
          alt="Reported hazard field proof"
          className="h-44 w-full rounded-lg object-cover border border-border"
        />
      )}

      {/* Field notes */}
      {report.note && (
        <p className="text-xs bg-muted/40 p-2.5 rounded-md border border-border text-foreground">
          {report.note}
        </p>
      )}

      {/* Confirmations count */}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="flex items-center gap-1.5 font-semibold text-accent">
          <ShieldCheck className="size-4" />
          {report.verification_count} Community Confirmations
        </span>
        {report.assigned_crew && (
          <span className="text-[11px] text-emerald-400 font-semibold">
            {report.assigned_crew.split(" - ")[0]}
          </span>
        )}
      </div>

      {/* Community Verification Interaction */}
      <div className="space-y-2 border-t border-border pt-3">
        <p className="label-caps">Community Verification Interaction</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onVote(report.id, "still_broken")}
            className="flex items-center justify-center gap-1.5 rounded-md border border-red-500/40 bg-red-950/20 py-2.5 font-display text-xs font-bold tracking-wider text-red-300 uppercase hover:bg-red-950/40 transition-colors"
          >
            <AlertTriangle className="size-3.5" />
            Confirm: Still Broken
          </button>
          <button
            onClick={() => onVote(report.id, "resolved")}
            className="flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-950/20 py-2.5 font-display text-xs font-bold tracking-wider text-emerald-300 uppercase hover:bg-emerald-950/40 transition-colors"
          >
            <CheckCircle2 className="size-3.5" />
            Report: Fixed / Cleared
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          {hasVoted ? "You have verified this pin." : `Verifying atomically updates hazard credibility & awards +${XP_VALIDATION} XP.`}
        </p>
      </div>
    </div>
  );
}
