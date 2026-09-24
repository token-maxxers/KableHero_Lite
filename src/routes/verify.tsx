import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Tag,
  Crosshair,
  CheckCircle2,
  Filter,
  Camera,
  Flame,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { fetchAllReports, updateReportStatus } from "@/lib/reports";
import {
  HAZARD_TIERS,
  STATUS_LABEL,
  TIER_COLOR,
  getDistanceMeters,
  timeAgo,
  type HazardReport,
  type HazardTier,
} from "@/lib/kable";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Tanod Verification — KableHero" },
      {
        name: "description",
        content: "Barangay Tanod field verification queue for reported electric hazards.",
      },
    ],
  }),
  component: TanodVerificationPage,
});

function TanodVerificationPage() {
  return (
    <RoleGuard allowedRoles={["tanod"]} requiredTitle="Barangay Tanod">
      <TanodContent />
    </RoleGuard>
  );
}

function TanodContent() {
  const { user, profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<"pending" | "verified" | "all">("pending");
  const [tierFilter, setTierFilter] = useState<HazardTier | "all">("all");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Tanod current GPS location for distance sorting
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // Default to Manolo Fortich Bukidnon center if blocked
          setCoords({ lat: 8.3671, lng: 124.8645 });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  const { data: reports = [], refetch, isFetching } = useQuery({
    queryKey: ["reports"],
    queryFn: () => fetchAllReports(),
    refetchInterval: 12000,
  });

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filter === "pending" && r.is_tanod_verified) return false;
      if (filter === "verified" && !r.is_tanod_verified) return false;
      if (tierFilter !== "all" && r.hazard_tier !== tierFilter) return false;
      return true;
    });
  }, [reports, filter, tierFilter]);

  const stats = useMemo(() => {
    const pending = reports.filter((r) => !r.is_tanod_verified && r.status !== "resolved").length;
    const verified = reports.filter((r) => r.is_tanod_verified).length;
    return { pending, verified, total: reports.length };
  }, [reports]);

  const handleVerify = async (report: HazardReport) => {
    setVerifyingId(report.id);
    const nextState = !report.is_tanod_verified;
    try {
      await updateReportStatus(report.id, {
        isTanodVerified: nextState,
      });

      if (nextState) {
        toast.success("Hazard confirmed on-site! Tanod badge stamped on incident.");
      } else {
        toast.info("Tanod verification status revoked.");
      }

      await refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch {
      toast.error("Could not update verification status");
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-4 px-4 py-4 max-w-2xl mx-auto">
        {/* Tanod Banner */}
        <section className="clay-card-emerald p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <span className="clay-pill bg-emerald-100 text-emerald-900 px-2.5 py-0.5 text-[10px] uppercase tracking-wider">
                  Barangay Patrol Clearance
                </span>
                <h1 className="text-xl font-bold uppercase tracking-tight text-emerald-950 mt-0.5">
                  Tanod Field Verifier
                </h1>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="clay-btn clay-btn-neutral p-2 text-emerald-900"
              title="Refresh Queue"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>

          <p className="mt-2 text-xs text-emerald-900 leading-relaxed font-medium">
            Tanods physically inspect reported hazards to eliminate false alarms and prioritize high-risk line breaks for BUSECO linemen.
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-emerald-200/60 text-center">
            <div className="clay-card bg-white/90 p-2">
              <span className="block text-lg font-bold text-amber-600">{stats.pending}</span>
              <span className="block text-[10px] text-slate-600 uppercase font-semibold">Needs Audit</span>
            </div>
            <div className="clay-card bg-white/90 p-2">
              <span className="block text-lg font-bold text-emerald-600">{stats.verified}</span>
              <span className="block text-[10px] text-slate-600 uppercase font-semibold">Verified</span>
            </div>
            <div className="clay-card bg-white/90 p-2">
              <span className="block text-lg font-bold text-slate-800">{stats.total}</span>
              <span className="block text-[10px] text-slate-600 uppercase font-semibold">Total Logs</span>
            </div>
          </div>
        </section>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5">
            {(["pending", "verified", "all"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`clay-btn px-3 py-1.5 text-xs uppercase tracking-wider ${
                  filter === tab
                    ? "clay-btn-tanod text-white"
                    : "clay-btn-neutral text-slate-700"
                }`}
              >
                {tab === "pending"
                  ? `Pending (${stats.pending})`
                  : tab === "verified"
                  ? `Verified (${stats.verified})`
                  : "All Hazards"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {(["all", "critical", "urgent", "low"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                className={`size-7 rounded-xl flex items-center justify-center text-xs font-bold transition-transform ${
                  tierFilter === t ? "scale-110 shadow-md ring-2 ring-emerald-500" : "opacity-60"
                }`}
                style={{
                  backgroundColor:
                    t === "critical"
                      ? "#ef4444"
                      : t === "urgent"
                      ? "#f97316"
                      : t === "low"
                      ? "#eab308"
                      : "#94a3b8",
                  color: "#ffffff",
                }}
                title={t.toUpperCase()}
              >
                {t === "all" ? "•" : t[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Report Queue Cards */}
        {filtered.length === 0 ? (
          <div className="clay-card p-8 text-center space-y-2">
            <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
            <h3 className="font-display text-lg font-bold uppercase text-slate-800">
              No reports in this queue
            </h3>
            <p className="text-xs text-slate-500">
              All hazard reports in your area are currently up to date.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => {
              const tierInfo = HAZARD_TIERS.find((t) => t.tier === report.hazard_tier);
              const dist = coords
                ? getDistanceMeters(coords.lat, coords.lng, report.lat, report.lng)
                : null;
              const isWorking = verifyingId === report.id;

              return (
                <div
                  key={report.id}
                  className={`clay-card p-4 space-y-3 ${
                    report.is_tanod_verified ? "border-emerald-300 bg-emerald-50/20" : ""
                  }`}
                >
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="clay-pill px-2.5 py-0.5 text-xs text-white uppercase"
                        style={{
                          backgroundColor:
                            report.hazard_tier === "critical"
                              ? "#ef4444"
                              : report.hazard_tier === "urgent"
                              ? "#f97316"
                              : "#eab308",
                        }}
                      >
                        {tierInfo?.dot} {tierInfo?.label}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {timeAgo(report.created_at)}
                      </span>
                    </div>

                    {report.is_tanod_verified ? (
                      <span className="clay-pill bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] uppercase flex items-center gap-1 font-bold">
                        <ShieldCheck className="size-3 text-emerald-600" />
                        Tanod Verified
                      </span>
                    ) : (
                      <span className="clay-pill bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] uppercase flex items-center gap-1 font-bold">
                        <ShieldAlert className="size-3 text-amber-600" />
                        Pending Verification
                      </span>
                    )}
                  </div>

                  {/* Hazard Title & Content */}
                  <div>
                    <h2 className="font-display text-base font-bold uppercase text-slate-900 leading-tight">
                      {tierInfo?.title}
                    </h2>
                    {report.note && (
                      <p className="mt-1 text-xs text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100 font-medium">
                        "{report.note}"
                      </p>
                    )}
                  </div>

                  {/* Location & Pole Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {report.landmark || `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Tag className="size-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono font-bold text-slate-800">
                        {report.pole_number || "NO POLE TAG"}
                      </span>
                    </div>
                  </div>

                  {/* Distance estimation */}
                  {dist !== null && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <Crosshair className="size-3 text-slate-400" />
                      <span>
                        Approx. {dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`} away from your GPS patrol
                      </span>
                    </div>
                  )}

                  {/* Tanod Action Button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      Status: <strong>{STATUS_LABEL[report.status]}</strong>
                    </span>

                    <button
                      onClick={() => handleVerify(report)}
                      disabled={isWorking}
                      className={`clay-btn px-4 py-2 text-xs tracking-wider uppercase font-bold ${
                        report.is_tanod_verified
                          ? "clay-btn-neutral text-slate-600 hover:text-red-600"
                          : "clay-btn-tanod text-emerald-950"
                      }`}
                    >
                      {isWorking ? (
                        "Updating…"
                      ) : report.is_tanod_verified ? (
                        "Revoke Verification"
                      ) : (
                        <>
                          <ShieldCheck className="mr-1 size-4 text-emerald-900" />
                          Confirm On-Site (Stamp Badge)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
