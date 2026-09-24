import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Flame,
  Truck,
  CheckCircle2,
  Wrench,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Users,
  CreditCard,
  MapPin,
  ExternalLink,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import HazardMap from "./HazardMap";
import {
  HazardReport,
  HazardTier,
  ReportStatus,
  HAZARD_TIERS,
  STATUS_LABEL,
  TIER_COLOR,
  DISPATCH_CREWS,
  timeAgo,
} from "@/lib/kable";
import {
  IncidentGroup,
  groupReportsIntoIncidents,
  updateReportStatus,
  fetchAllReports,
} from "@/lib/reports";
import {
  getStoredVouchers,
  applyVoucherToElectricBill,
} from "@/lib/vouchers";

interface AdminDispatchConsoleProps {
  reports: HazardReport[];
  onRefresh: () => void;
}

export function AdminDispatchConsole({ reports, onRefresh }: AdminDispatchConsoleProps) {
  const [activeTab, setActiveTab] = useState<"triage" | "vouchers">("triage");
  const [tierFilter, setTierFilter] = useState<HazardTier | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [assigningCrewForId, setAssigningCrewForId] = useState<string | null>(null);

  // Voucher audit state
  const [voucherSearchCode, setVoucherSearchCode] = useState("");
  const [consumerAccountInput, setConsumerAccountInput] = useState("");
  const [vouchersVersion, setVouchersVersion] = useState(0);

  // Group raw reports into clustered incident tickets (duplicate grouping)
  const incidentGroups = useMemo(() => {
    return groupReportsIntoIncidents(reports);
  }, [reports]);

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    return incidentGroups.filter((group) => {
      const p = group.primary;
      if (tierFilter !== "all" && p.hazard_tier !== tierFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const landmarkMatch = (p.landmark || "").toLowerCase().includes(q);
        const poleMatch = (p.pole_number || "").toLowerCase().includes(q);
        const noteMatch = (p.note || "").toLowerCase().includes(q);
        if (!landmarkMatch && !poleMatch && !noteMatch) return false;
      }
      return true;
    });
  }, [incidentGroups, tierFilter, statusFilter, searchQuery]);

  // Selected incident details
  const selectedIncident = useMemo(() => {
    if (!selectedIncidentId) return filteredIncidents[0] || null;
    return (
      incidentGroups.find(
        (g) => g.primary.id === selectedIncidentId || g.duplicates.some((d) => d.id === selectedIncidentId)
      ) || null
    );
  }, [selectedIncidentId, incidentGroups, filteredIncidents]);

  // Quick summary counts
  const stats = useMemo(() => {
    const critical = reports.filter((r) => r.hazard_tier === "critical" && r.status !== "resolved").length;
    const urgent = reports.filter((r) => r.hazard_tier === "urgent" && r.status !== "resolved").length;
    const low = reports.filter((r) => r.hazard_tier === "low" && r.status !== "resolved").length;
    const dispatched = reports.filter((r) => r.status === "dispatched" || r.status === "repairing").length;
    const resolved = reports.filter((r) => r.status === "resolved").length;
    return { critical, urgent, low, dispatched, resolved, total: reports.length };
  }, [reports]);

  // Handle Dispatch status changes
  const handleStatusChange = async (reportId: string, newStatus: ReportStatus) => {
    try {
      await updateReportStatus(reportId, { status: newStatus });
      toast.success(`Ticket marked as '${STATUS_LABEL[newStatus]}'. Syncing with public map.`);
      onRefresh();
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Handle Crew Assignment
  const handleAssignCrew = async (reportId: string, crewName: string) => {
    try {
      await updateReportStatus(reportId, {
        status: "dispatched",
        assignedCrew: crewName,
      });
      setAssigningCrewForId(null);
      toast.success(`Assigned ${crewName}. Status set to Dispatched.`);
      onRefresh();
    } catch {
      toast.error("Failed to assign crew");
    }
  };

  // Handle Tanod Verification toggle
  const handleToggleTanod = async (reportId: string, currentVal: boolean) => {
    try {
      await updateReportStatus(reportId, { isTanodVerified: !currentVal });
      toast.success(!currentVal ? "Marked as Barangay Tanod Verified." : "Tanod verification removed.");
      onRefresh();
    } catch {
      toast.error("Failed to update verification");
    }
  };

  // Vouchers registry
  const allVouchers = useMemo(() => {
    return getStoredVouchers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vouchersVersion]);

  // Process voucher application
  const handleApplyVoucher = (code: string) => {
    if (!consumerAccountInput.trim()) {
      toast.error("Please enter the Consumer Electric Account Number (e.g. BUSECO-ACC-10293).");
      return;
    }
    const res = applyVoucherToElectricBill(code, consumerAccountInput);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(`Voucher ${code} successfully applied! ₱${res.voucher?.discountPeso} credited to ${consumerAccountInput}.`);
    setConsumerAccountInput("");
    setVouchersVersion((v) => v + 1);
  };

  return (
    <div className="flex flex-col bg-background text-foreground">
      {/* Top Operations Header */}
      <header className="clay-card m-2 sm:m-4 p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md">
              <Flame className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="clay-pill bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                  BUSECO Operations
                </span>
                <span className="text-[11px] text-slate-500 font-medium">· Dispatch Console</span>
              </div>
              <h1 className="font-display text-lg font-bold tracking-wider uppercase text-slate-900 mt-0.5">
                Bukidnon Second Electric Cooperative Triage Command
              </h1>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("triage")}
              className={`clay-btn px-3.5 py-2 text-xs uppercase tracking-wider font-bold ${
                activeTab === "triage"
                  ? "clay-btn-primary"
                  : "clay-btn-neutral text-slate-700"
              }`}
            >
              <Layers className="mr-1.5 size-3.5" />
              Triage Queue & Map
            </button>
            <button
              onClick={() => setActiveTab("vouchers")}
              className={`clay-btn px-3.5 py-2 text-xs uppercase tracking-wider font-bold ${
                activeTab === "vouchers"
                  ? "clay-btn-primary"
                  : "clay-btn-neutral text-slate-700"
              }`}
            >
              <CreditCard className="mr-1.5 size-3.5" />
              Voucher Audit Desk
            </button>
            <button
              onClick={onRefresh}
              title="Refresh live feeds"
              className="clay-btn clay-btn-neutral size-9 p-0 text-slate-700"
            >
              <RefreshCw className="size-4" />
            </button>
          </div>
        </div>

        {/* Live Metrics Ticker */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 pt-2 border-t border-slate-100">
          <div className="clay-card bg-red-50/80 border-red-200 p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-display text-[11px] tracking-wider text-red-900 uppercase font-bold">Critical</span>
              <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <p className="font-display text-2xl font-extrabold text-red-600">{stats.critical}</p>
          </div>
          <div className="clay-card bg-orange-50/80 border-orange-200 p-2.5">
            <span className="font-display text-[11px] tracking-wider text-orange-900 uppercase font-bold">Urgent</span>
            <p className="font-display text-2xl font-extrabold text-orange-600">{stats.urgent}</p>
          </div>
          <div className="clay-card bg-yellow-50/80 border-yellow-200 p-2.5">
            <span className="font-display text-[11px] tracking-wider text-amber-900 uppercase font-bold">Low Risk</span>
            <p className="font-display text-2xl font-extrabold text-amber-600">{stats.low}</p>
          </div>
          <div className="clay-card bg-blue-50/80 border-blue-200 p-2.5">
            <span className="font-display text-[11px] tracking-wider text-blue-900 uppercase font-bold">Dispatched</span>
            <p className="font-display text-2xl font-extrabold text-blue-600">{stats.dispatched}</p>
          </div>
          <div className="clay-card bg-emerald-50/80 border-emerald-200 p-2.5">
            <span className="font-display text-[11px] tracking-wider text-emerald-900 uppercase font-bold">Resolved</span>
            <p className="font-display text-2xl font-extrabold text-emerald-600">{stats.resolved}</p>
          </div>
          <div className="clay-card bg-slate-50 p-2.5">
            <span className="font-display text-[11px] tracking-wider text-slate-700 uppercase font-bold">Incidents</span>
            <p className="font-display text-2xl font-extrabold text-slate-900">{incidentGroups.length}</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === "triage" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-14rem)]">
          {/* Left Column: Automated Priority Triage Queue (lg:col-span-5) */}
          <div className="flex flex-col border-r border-border bg-background lg:col-span-5">
            {/* Filter Bar */}
            <div className="border-b border-border bg-surface/50 p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter by landmark, pole number (e.g. BUSECO-1234)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:border-ring"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="label-caps mr-1 text-[10px]">Filter:</span>
                <button
                  onClick={() => setTierFilter("all")}
                  className={`rounded px-2 py-0.5 font-display uppercase tracking-wider text-[11px] ${
                    tierFilter === "all" ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  All Tiers
                </button>
                {HAZARD_TIERS.map((t) => (
                  <button
                    key={t.tier}
                    onClick={() => setTierFilter(t.tier)}
                    className={`rounded px-2 py-0.5 font-display uppercase tracking-wider text-[11px] flex items-center gap-1 ${
                      tierFilter === t.tier
                        ? "bg-primary text-primary-foreground font-bold"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span>{t.dot}</span>
                    {t.tier}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="label-caps mr-1 text-[10px]">Status:</span>
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`rounded px-2 py-0.5 font-display uppercase tracking-wider text-[11px] ${
                    statusFilter === "all" ? "bg-accent text-accent-foreground font-bold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter("reported")}
                  className={`rounded px-2 py-0.5 font-display uppercase tracking-wider text-[11px] ${
                    statusFilter === "reported" ? "bg-accent text-accent-foreground font-bold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  Reported
                </button>
                <button
                  onClick={() => setStatusFilter("dispatched")}
                  className={`rounded px-2 py-0.5 font-display uppercase tracking-wider text-[11px] ${
                    statusFilter === "dispatched" ? "bg-accent text-accent-foreground font-bold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  Dispatched
                </button>
                <button
                  onClick={() => setStatusFilter("resolved")}
                  className={`rounded px-2 py-0.5 font-display uppercase tracking-wider text-[11px] ${
                    statusFilter === "resolved" ? "bg-accent text-accent-foreground font-bold" : "bg-muted text-muted-foreground"
                  }`}
                >
                  Resolved
                </button>
              </div>
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[70vh]">
              {filteredIncidents.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No incident tickets match the selected filters.
                </div>
              ) : (
                filteredIncidents.map((group) => {
                  const p = group.primary;
                  const isSelected = selectedIncident?.primary.id === p.id;
                  const isCritical = p.hazard_tier === "critical";

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedIncidentId(p.id)}
                      className={`cursor-pointer rounded-lg border transition-all p-3 text-left ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : isCritical
                          ? "border-red-500/40 bg-red-950/10 hover:border-red-500/60"
                          : "border-border bg-surface/40 hover:border-border/80"
                      }`}
                    >
                      {/* Priority header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: TIER_COLOR[p.hazard_tier] }}
                          />
                          <span
                            className="font-display text-xs font-bold tracking-wider uppercase"
                            style={{ color: TIER_COLOR[p.hazard_tier] }}
                          >
                            {p.hazard_tier}
                          </span>
                          <span className="text-[11px] text-muted-foreground">· {timeAgo(p.created_at)}</span>
                        </div>

                        {/* Duplicate Grouping Badge */}
                        {group.totalReports > 1 && (
                          <span className="flex items-center gap-1 rounded bg-blue-500/20 px-1.5 py-0.5 font-display text-[10px] tracking-wider text-blue-300 uppercase font-semibold">
                            <Users className="size-3" />
                            {group.totalReports} reports merged
                          </span>
                        )}
                      </div>

                      {/* Location & Pole */}
                      <h4 className="mt-1.5 font-display text-sm font-semibold tracking-wide text-foreground uppercase">
                        {p.landmark || "Bukidnon Cooperative Sector"}
                      </h4>

                      {p.pole_number && (
                        <p className="text-xs font-mono text-amber-300 font-medium">
                          Pole: {p.pole_number}
                        </p>
                      )}

                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {p.note || "Electrical line disruption flagged by citizen."}
                      </p>

                      {/* Footer tags */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded bg-muted px-2 py-0.5 font-display tracking-wider uppercase">
                          {STATUS_LABEL[p.status]}
                        </span>

                        {p.assigned_crew && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Truck className="size-3" />
                            {p.assigned_crew.split(" - ")[0]}
                          </span>
                        )}

                        {group.totalConfirmations > 0 && (
                          <span className="flex items-center gap-1 text-accent">
                            <ShieldCheck className="size-3" />
                            {group.totalConfirmations} confirms
                          </span>
                        )}

                        {p.is_tanod_verified && (
                          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300 font-semibold uppercase">
                            Tanod Verified
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Geospatial Split Map & Live Ticket Inspector (lg:col-span-7) */}
          <div className="flex flex-col bg-background lg:col-span-7">
            {/* Interactive Map View */}
            <div className="h-[46vh] w-full border-b border-border relative">
              <HazardMap
                reports={reports.map((r) => ({
                  id: r.id,
                  lat: r.lat,
                  lng: r.lng,
                  hazard_tier: r.hazard_tier,
                  status: r.status,
                  verification_count: r.verification_count,
                  landmark: r.landmark,
                  pole_number: r.pole_number,
                }))}
                center={
                  selectedIncident
                    ? [selectedIncident.primary.lat, selectedIncident.primary.lng]
                    : undefined
                }
                selectedId={selectedIncident?.primary.id || null}
                onSelect={(id) => setSelectedIncidentId(id)}
                className="size-full"
              />

              {/* Map Floating Alert Banner for Top Critical Issue */}
              {stats.critical > 0 && (
                <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 rounded-md border border-red-500/40 bg-red-950/90 px-3 py-1.5 text-xs text-red-200 backdrop-blur shadow-lg">
                  <ShieldAlert className="size-4 text-red-400 animate-pulse" />
                  <span>
                    <strong>{stats.critical} Critical Hazard{stats.critical > 1 ? "s" : ""}</strong> require immediate crew dispatch!
                  </span>
                </div>
              )}
            </div>

            {/* Selected Incident Action & Lifecycle Panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedIncident ? (
                <div className="panel p-4 space-y-4">
                  {/* Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: TIER_COLOR[selectedIncident.primary.hazard_tier] }}
                        />
                        <span
                          className="font-display text-base font-bold tracking-wide uppercase"
                          style={{ color: TIER_COLOR[selectedIncident.primary.hazard_tier] }}
                        >
                          {selectedIncident.primary.hazard_tier} incident
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {timeAgo(selectedIncident.primary.created_at)}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-lg font-semibold uppercase text-foreground">
                        {selectedIncident.primary.landmark || "Rural Electric Segment"}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        GPS: {selectedIncident.primary.lat.toFixed(5)}, {selectedIncident.primary.lng.toFixed(5)}
                        {selectedIncident.primary.pole_number && (
                          <span className="ml-2 text-amber-300 font-bold">
                            · POLE #{selectedIncident.primary.pole_number}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleToggleTanod(
                            selectedIncident.primary.id,
                            selectedIncident.primary.is_tanod_verified
                          )
                        }
                        className={`rounded px-2.5 py-1 text-xs font-display tracking-wider uppercase border transition-colors ${
                          selectedIncident.primary.is_tanod_verified
                            ? "border-amber-500 bg-amber-500/20 text-amber-300"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {selectedIncident.primary.is_tanod_verified
                          ? "✓ Tanod Verified"
                          : "Verify as Tanod"}
                      </button>
                    </div>
                  </div>

                  {/* Photo Proof & Description */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {selectedIncident.primary.photo_url ? (
                      <div className="md:col-span-1">
                        <img
                          src={selectedIncident.primary.photo_url}
                          alt="Hazard field proof"
                          className="h-32 w-full rounded-md object-cover border border-border"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground text-center">
                          Native camera field capture
                        </p>
                      </div>
                    ) : (
                      <div className="md:col-span-1 flex h-32 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                        <span>No photo attached</span>
                        <span className="text-[10px]">(Low-bandwidth / SMS report)</span>
                      </div>
                    )}

                    <div className="md:col-span-2 space-y-2">
                      <p className="label-caps">Field Report Notes</p>
                      <p className="text-sm bg-muted/40 p-2.5 rounded-md border border-border">
                        {selectedIncident.primary.note || "No additional text provided. Geolocation locked."}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="size-4 text-accent" />
                          {selectedIncident.totalConfirmations} Community Confirmations
                        </span>
                        <span>Reporter: {selectedIncident.primary.user_id.substring(0, 8)}...</span>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Grouping Accordion */}
                  {selectedIncident.duplicates.length > 0 && (
                    <div className="rounded-md border border-blue-500/30 bg-blue-950/20 p-3">
                      <div
                        onClick={() =>
                          setExpandedGroupId(
                            expandedGroupId === selectedIncident.primary.id
                              ? null
                              : selectedIncident.primary.id
                          )
                        }
                        className="flex cursor-pointer items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="size-4 text-blue-400" />
                          <span className="font-display text-xs font-semibold tracking-wider text-blue-300 uppercase">
                            Duplicate Pin Grouping: {selectedIncident.duplicates.length} additional neighbor report(s) merged
                          </span>
                        </div>
                        {expandedGroupId === selectedIncident.primary.id ? (
                          <ChevronUp className="size-4 text-blue-400" />
                        ) : (
                          <ChevronDown className="size-4 text-blue-400" />
                        )}
                      </div>

                      {expandedGroupId === selectedIncident.primary.id && (
                        <div className="mt-3 space-y-2 border-t border-blue-500/20 pt-2">
                          <p className="text-[11px] text-blue-200">
                            The system detected multiple calls within a 50m radius or sharing pole identification. Grouped into one work order to prevent duplicate truck dispatches:
                          </p>
                          {selectedIncident.duplicates.map((dup, idx) => (
                            <div
                              key={dup.id}
                              className="rounded bg-surface/80 p-2 text-xs border border-border flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold">Neighbor #{idx + 1}:</span> {dup.landmark || "Nearby street spot"}
                                <span className="block text-[11px] text-muted-foreground">
                                  {dup.note || "Reported line hazard"} · {timeAgo(dup.created_at)}
                                </span>
                              </div>
                              <span className="text-[11px] text-accent">+{dup.verification_count} votes</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Operational Lifecycle Stepper */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <p className="label-caps">Dispatch Lifecycle Management</p>
                      <span className="text-xs text-muted-foreground">
                        Current: <strong className="text-primary uppercase">{STATUS_LABEL[selectedIncident.primary.status]}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => handleStatusChange(selectedIncident.primary.id, "reported")}
                        className={`rounded-md border p-2 text-center transition-all ${
                          selectedIncident.primary.status === "reported"
                            ? "border-primary bg-primary/20 text-primary font-bold"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="block font-display text-xs tracking-wider uppercase">1. Reported</span>
                        <span className="text-[10px]">Triage Queue</span>
                      </button>

                      <button
                        onClick={() => handleStatusChange(selectedIncident.primary.id, "dispatched")}
                        className={`rounded-md border p-2 text-center transition-all ${
                          selectedIncident.primary.status === "dispatched"
                            ? "border-blue-500 bg-blue-500/20 text-blue-300 font-bold"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="block font-display text-xs tracking-wider uppercase">2. Dispatched</span>
                        <span className="text-[10px]">En Route</span>
                      </button>

                      <button
                        onClick={() => handleStatusChange(selectedIncident.primary.id, "repairing")}
                        className={`rounded-md border p-2 text-center transition-all ${
                          selectedIncident.primary.status === "repairing"
                            ? "border-orange-500 bg-orange-500/20 text-orange-300 font-bold"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="block font-display text-xs tracking-wider uppercase">3. Repairing</span>
                        <span className="text-[10px]">Linemen on Site</span>
                      </button>

                      <button
                        onClick={() => handleStatusChange(selectedIncident.primary.id, "resolved")}
                        className={`rounded-md border p-2 text-center transition-all ${
                          selectedIncident.primary.status === "resolved"
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold"
                            : "border-border hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="block font-display text-xs tracking-wider uppercase">4. Fixed / Safe</span>
                        <span className="text-[10px]">Clear Map Pin</span>
                      </button>
                    </div>
                  </div>

                  {/* Lineman Crew Deployment Dropdown */}
                  <div className="rounded-md border border-border bg-surface/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="label-caps flex items-center gap-1.5">
                        <Truck className="size-3.5 text-primary" />
                        Lineman Crew Assignment
                      </span>
                      {selectedIncident.primary.assigned_crew && (
                        <span className="text-xs font-semibold text-emerald-400">
                          Assigned: {selectedIncident.primary.assigned_crew}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DISPATCH_CREWS.map((crew) => (
                        <button
                          key={crew.id}
                          onClick={() => handleAssignCrew(selectedIncident.primary.id, crew.name)}
                          className={`rounded border p-2 text-left text-xs transition-colors ${
                            selectedIncident.primary.assigned_crew === crew.name
                              ? "border-primary bg-primary/20 text-foreground"
                              : "border-border hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          <div className="font-semibold text-foreground">{crew.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {crew.vehicle} · Lead: {crew.leader}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Select an incident ticket from the queue or map to inspect details and deploy crews.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Voucher Claim Audit Tool */
        <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
          <div className="panel p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded bg-primary/20 text-primary">
                <CreditCard className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-wider">
                  Consumer Electric Voucher Verification Desk
                </h2>
                <p className="text-xs text-muted-foreground">
                  Verify citizen-earned safety vouchers and credit discounts to BUSECO electric billing accounts.
                </p>
              </div>
            </div>

            {/* Quick Verification Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="label-caps">Voucher Code</label>
                <input
                  type="text"
                  placeholder="e.g. BUSECO-50-H7P2X"
                  value={voucherSearchCode}
                  onChange={(e) => setVoucherSearchCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-ring"
                />
              </div>

              <div>
                <label className="label-caps">Consumer Account No.</label>
                <input
                  type="text"
                  placeholder="e.g. BUSECO-ACC-881920"
                  value={consumerAccountInput}
                  onChange={(e) => setConsumerAccountInput(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-ring"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => handleApplyVoucher(voucherSearchCode)}
                  disabled={!voucherSearchCode.trim()}
                  className="w-full rounded-md bg-primary py-2.5 font-display text-sm font-semibold tracking-wider text-primary-foreground uppercase disabled:opacity-50"
                >
                  Verify & Apply Credit
                </button>
              </div>
            </div>
          </div>

          {/* Active Vouchers Table */}
          <div className="panel p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold uppercase tracking-wider">
                Claimed Safety Vouchers Registry ({allVouchers.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                Auto-synced with citizen redemptions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-display uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-3">Voucher Code</th>
                    <th className="py-2.5 px-3">Citizen Name</th>
                    <th className="py-2.5 px-3">Reward Value</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Applied Account</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allVouchers.map((v) => {
                    const isApplied = v.status === "applied_to_bill";
                    return (
                      <tr key={v.id} className="hover:bg-muted/20">
                        <td className="py-3 px-3 font-mono font-bold text-primary">
                          {v.code}
                        </td>
                        <td className="py-3 px-3 font-medium">
                          {v.userName}
                          <span className="block text-[11px] text-muted-foreground">
                            Issued {timeAgo(v.createdAt)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-emerald-400">
                            ₱{v.discountPeso} Bill Credit
                          </span>
                          <span className="block text-[10px] text-muted-foreground">{v.title}</span>
                        </td>
                        <td className="py-3 px-3">
                          {isApplied ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 font-display text-[10px] tracking-wider text-emerald-300 uppercase font-semibold">
                              ✓ Applied to Bill
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 font-display text-[10px] tracking-wider text-amber-300 uppercase font-semibold">
                              Pending Utility Apply
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {v.appliedAccountNo ? (
                            <span>
                              {v.appliedAccountNo}
                              <span className="block text-[10px] text-muted-foreground">
                                By {v.appliedBy}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {!isApplied ? (
                            <button
                              onClick={() => {
                                setVoucherSearchCode(v.code);
                                toast.info(`Selected ${v.code}. Enter consumer account number above to finalize.`);
                              }}
                              className="rounded border border-border px-2.5 py-1 font-display text-[11px] tracking-wider uppercase hover:bg-muted text-foreground"
                            >
                              Audit / Credit
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {v.appliedAt ? new Date(v.appliedAt).toLocaleDateString() : "Redeemed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
