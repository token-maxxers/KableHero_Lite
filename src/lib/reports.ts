import { supabase } from "@/integrations/supabase/client";
import {
  HazardReport,
  HazardTier,
  ReportStatus,
  getDistanceMeters,
} from "./kable";

const LOCAL_STORAGE_REPORTS_KEY = "kablehero_reports_cache_v2";
const BROADCAST_CHANNEL = "kablehero_realtime_events";

// Initial realistic seed reports for BUSECO (Bukidnon Second Electric Cooperative) franchise area
export const SEED_REPORTS: HazardReport[] = [
  {
    id: "rep-buseco-001",
    user_id: "demo-user-1",
    lat: 8.3671,
    lng: 124.8645, // Manolo Fortich, Bukidnon
    hazard_tier: "critical",
    status: "reported",
    verification_count: 7,
    photo_url: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=800&auto=format&fit=crop&q=80",
    landmark: "Near Yellow Sari-Sari Store & Purok 2 Waiting Shed, Sayre Hwy",
    pole_number: "BUSECO-MF-0412",
    assigned_crew: null,
    is_tanod_verified: true,
    note: "High-voltage 13.2kV wire snapped across road after heavy wind gusts. Sparks visible.",
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: "rep-buseco-002",
    user_id: "demo-user-2",
    lat: 8.3673,
    lng: 124.8648, // Nearby ~35m away (demonstrating duplicate grouping)
    hazard_tier: "critical",
    status: "reported",
    verification_count: 4,
    photo_url: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=800&auto=format&fit=crop&q=80",
    landmark: "Across Sayre Highway KM 24, adjacent to sari-sari store",
    pole_number: "BUSECO-MF-0412",
    assigned_crew: null,
    is_tanod_verified: false,
    note: "Live line hanging very low over pavement, vehicles swerving.",
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: "rep-buseco-003",
    user_id: "demo-user-3",
    lat: 8.1574,
    lng: 125.1277, // Malaybalay City, Bukidnon
    hazard_tier: "urgent",
    status: "dispatched",
    verification_count: 5,
    photo_url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80",
    landmark: "Corner Fortich St & San Isidro Cathedral back road",
    pole_number: "BUSECO-MB-1092",
    assigned_crew: "Crew Bravo - Malaybalay Quick-Response",
    is_tanod_verified: true,
    note: "Heavy wooden pole tilted at 30 degrees toward school tricycle terminal.",
    created_at: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  },
  {
    id: "rep-buseco-004",
    user_id: "demo-user-4",
    lat: 8.1251,
    lng: 125.1325, // Malaybalay outskirts
    hazard_tier: "low",
    status: "repairing",
    verification_count: 2,
    photo_url: null,
    landmark: "Purok 4 Basketball Court, Barangay Casisang",
    pole_number: "BUSECO-CS-0219",
    assigned_crew: "Crew Alpha - Bukidnon Sector 1 (Sayre Highway)",
    is_tanod_verified: false,
    note: "Sagging black fiber cable hanging 2 meters above ground. Tripping delivery trucks.",
    created_at: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: "rep-buseco-005",
    user_id: "demo-user-5",
    lat: 8.3589,
    lng: 124.8512, // Tankulan, Manolo Fortich
    hazard_tier: "critical",
    status: "resolved",
    verification_count: 9,
    photo_url: null,
    landmark: "Barangay Tankulan Gymnasium Entrance",
    pole_number: "BUSECO-TK-0055",
    assigned_crew: "Crew Charlie - Manolo Fortich Heavy Unit",
    is_tanod_verified: true,
    note: "Fallen secondary conductor safely re-strung and transformer fuse replaced.",
    created_at: new Date(Date.now() - 320 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
];

/**
 * Encodes extra fields into the note text so that schema variations in Supabase
 * never break insertions.
 */
export function serializeReportNote(
  note: string | null,
  meta: {
    landmark?: string | null;
    pole_number?: string | null;
    assigned_crew?: string | null;
    is_tanod_verified?: boolean;
    photo_url?: string | null;
  }
): string {
  const payload = {
    note: note || "",
    landmark: meta.landmark || null,
    pole_number: meta.pole_number || null,
    assigned_crew: meta.assigned_crew || null,
    is_tanod_verified: Boolean(meta.is_tanod_verified),
    custom_photo_url: meta.photo_url || null,
  };
  return "__KH_META__" + JSON.stringify(payload);
}

/**
 * Parses note text into fields.
 */
export function deserializeReportNote(rawNote: string | null): {
  note: string | null;
  landmark: string | null;
  pole_number: string | null;
  assigned_crew: string | null;
  is_tanod_verified: boolean;
  custom_photo_url: string | null;
} {
  if (!rawNote) {
    return {
      note: null,
      landmark: null,
      pole_number: null,
      assigned_crew: null,
      is_tanod_verified: false,
      custom_photo_url: null,
    };
  }

  if (rawNote.startsWith("__KH_META__")) {
    try {
      const parsed = JSON.parse(rawNote.slice("__KH_META__".length));
      return {
        note: parsed.note || null,
        landmark: parsed.landmark || null,
        pole_number: parsed.pole_number || null,
        assigned_crew: parsed.assigned_crew || null,
        is_tanod_verified: Boolean(parsed.is_tanod_verified),
        custom_photo_url: parsed.custom_photo_url || null,
      };
    } catch {
      // Fallback if parsing fails
    }
  }

  return {
    note: rawNote,
    landmark: null,
    pole_number: null,
    assigned_crew: null,
    is_tanod_verified: false,
    custom_photo_url: null,
  };
}

/**
 * Converts a database row to a rich HazardReport.
 */
export function mapRowToHazardReport(row: Record<string, unknown>): HazardReport {
  const meta = deserializeReportNote((row.note as string) || null);

  // Status mapping: if DB has "reported" | "dispatched" | "resolved",
  // we support those plus custom "repairing" in note if specified
  let status = (row.status as ReportStatus) || "reported";
  if ((meta as Record<string, unknown>).custom_status) {
    status = (meta as Record<string, unknown>).custom_status as ReportStatus;
  }

  return {
    id: String(row.id),
    user_id: String(row.user_id || "anon"),
    lat: Number(row.lat),
    lng: Number(row.lng),
    hazard_tier: (row.hazard_tier as HazardTier) || "low",
    status,
    verification_count: Number(row.verification_count ?? 0),
    photo_url: (row.photo_url as string) || meta.custom_photo_url,
    landmark: (row.landmark as string) || meta.landmark,
    pole_number: (row.pole_number as string) || meta.pole_number,
    assigned_crew: (row.assigned_crew as string) || meta.assigned_crew,
    is_tanod_verified: (row.is_tanod_verified as boolean) ?? meta.is_tanod_verified,
    note: meta.note || (row.note as string) || null,
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
  };
}

/**
 * Loads reports from Supabase, merging with local storage cache and seed defaults.
 */
export async function fetchAllReports(): Promise<HazardReport[]> {
  let dbReports: HazardReport[] = [];
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (!error && Array.isArray(data) && data.length > 0) {
      dbReports = data.map((r) => mapRowToHazardReport(r as Record<string, unknown>));
    }
  } catch (err) {
    console.warn("Supabase fetch failed, falling back to local store:", err);
  }

  // Get local cache
  let localReports: HazardReport[] = [];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
      if (stored) {
        localReports = JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }

  // Merge map: DB items take precedence, then local user items, then seed items
  const map = new Map<string, HazardReport>();

  // Add seed reports first
  for (const s of SEED_REPORTS) {
    map.set(s.id, s);
  }

  // Overlay local items
  for (const l of localReports) {
    map.set(l.id, l);
  }

  // Overlay DB items
  for (const d of dbReports) {
    map.set(d.id, d);
  }

  const result = Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return result;
}

/**
 * Saves a new report to Supabase and local cache.
 */
export async function createHazardReport(input: {
  userId: string;
  lat: number;
  lng: number;
  hazardTier: HazardTier;
  photoUrl: string | null;
  landmark: string | null;
  poleNumber: string | null;
  note?: string | null;
}): Promise<HazardReport> {
  const notePayload = serializeReportNote(input.note || null, {
    landmark: input.landmark,
    pole_number: input.poleNumber,
    photo_url: input.photoUrl,
  });

  const newId = crypto.randomUUID();
  const reportObj: HazardReport = {
    id: newId,
    user_id: input.userId,
    lat: input.lat,
    lng: input.lng,
    hazard_tier: input.hazardTier,
    status: "reported",
    verification_count: 0,
    photo_url: input.photoUrl,
    landmark: input.landmark,
    pole_number: input.poleNumber,
    assigned_crew: null,
    is_tanod_verified: false,
    note: input.note || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Try Supabase insert
  try {
    const { data, error } = await supabase
      .from("reports")
      .insert({
        id: newId,
        user_id: input.userId,
        lat: input.lat,
        lng: input.lng,
        hazard_tier: input.hazardTier,
        photo_url: input.photoUrl,
        status: "reported",
        note: notePayload,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      const created = mapRowToHazardReport(data as Record<string, unknown>);
      syncLocalReport(created);
      broadcastChange("create", created);
      return created;
    }
  } catch (err) {
    console.warn("Could not insert directly to Supabase, saving to local cache:", err);
  }

  // 2. Local fallback
  syncLocalReport(reportObj);
  broadcastChange("create", reportObj);
  return reportObj;
}

/**
 * Updates a report's status, assigned crew, or Tanod verification flag.
 */
export async function updateReportStatus(
  reportId: string,
  updates: {
    status?: ReportStatus;
    assignedCrew?: string | null;
    isTanodVerified?: boolean;
    note?: string | null;
  }
): Promise<void> {
  // Update local cache
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
      const list: HazardReport[] = stored ? JSON.parse(stored) : [...SEED_REPORTS];
      const idx = list.findIndex((r) => r.id === reportId);
      if (idx >= 0) {
        const item = list[idx]!;
        if (updates.status !== undefined) item.status = updates.status;
        if (updates.assignedCrew !== undefined) item.assigned_crew = updates.assignedCrew;
        if (updates.isTanodVerified !== undefined) item.is_tanod_verified = updates.isTanodVerified;
        if (updates.note !== undefined) item.note = updates.note;
        item.updated_at = new Date().toISOString();
        localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(list));
        broadcastChange("update", item);
      }
    } catch (e) {
      console.warn("Failed to update local cache:", e);
    }
  }

  // Try Supabase update
  try {
    // Note: Database report_status enum allows 'reported' | 'dispatched' | 'resolved'
    // If 'repairing', we map to 'dispatched' in SQL enum and store repairing in note metadata
    const sqlStatus = updates.status === "repairing" ? "dispatched" : updates.status;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (sqlStatus) {
      updatePayload.status = sqlStatus;
    }

    await supabase.from("reports").update(updatePayload).eq("id", reportId);
  } catch (err) {
    console.warn("Supabase report status update warning:", err);
  }
}

/**
 * Upvotes / verifies an existing report (e.g. "Still Broken" or "Resolved").
 */
export async function verifyReport(
  reportId: string,
  userId: string,
  vote: "still_broken" | "resolved"
): Promise<{ newCount: number }> {
  let count = 0;

  // Local storage update
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
      const list: HazardReport[] = stored ? JSON.parse(stored) : [...SEED_REPORTS];
      const target = list.find((r) => r.id === reportId);
      if (target) {
        if (vote === "still_broken") {
          target.verification_count += 1;
        }
        target.updated_at = new Date().toISOString();
        count = target.verification_count;
        localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(list));
        broadcastChange("update", target);
      }
    } catch {
      // ignore
    }
  }

  // Try remote insert
  try {
    await supabase.from("validations").insert({
      report_id: reportId,
      user_id: userId,
      vote,
    });
  } catch (err) {
    console.warn("Supabase validation record insert warning:", err);
  }

  return { newCount: count };
}

function syncLocalReport(report: HazardReport) {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_REPORTS_KEY);
    const list: HazardReport[] = stored ? JSON.parse(stored) : [...SEED_REPORTS];
    const idx = list.findIndex((r) => r.id === report.id);
    if (idx >= 0) {
      list[idx] = report;
    } else {
      list.unshift(report);
    }
    localStorage.setItem(LOCAL_STORAGE_REPORTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function broadcastChange(type: "create" | "update", report: HazardReport) {
  try {
    // Send via Supabase realtime broadcast channel
    const channel = supabase.channel(BROADCAST_CHANNEL);
    void channel.send({
      type: "broadcast",
      event: "report_changed",
      payload: { type, report },
    });
  } catch {
    // ignore
  }

  // Also trigger window event for same-client tabs
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kablehero_report_updated", { detail: { type, report } }));
  }
}

/**
 * Duplicate Incident Grouping:
 * Aggregates reports that are within 50m of each other or share identical pole_numbers.
 */
export interface IncidentGroup {
  primary: HazardReport;
  duplicates: HazardReport[];
  totalReports: number;
  totalConfirmations: number;
  poleNumber: string | null;
  landmark: string | null;
  hasCritical: boolean;
}

export function groupReportsIntoIncidents(reports: HazardReport[]): IncidentGroup[] {
  const visited = new Set<string>();
  const groups: IncidentGroup[] = [];

  for (let i = 0; i < reports.length; i++) {
    const r = reports[i]!;
    if (visited.has(r.id)) continue;

    visited.add(r.id);
    const cluster: HazardReport[] = [r];

    for (let j = i + 1; j < reports.length; j++) {
      const other = reports[j]!;
      if (visited.has(other.id)) continue;

      // Group if sharing explicit pole number or distance < 50 meters
      const samePole = r.pole_number && other.pole_number && r.pole_number.trim().toUpperCase() === other.pole_number.trim().toUpperCase();
      const dist = getDistanceMeters(r.lat, r.lng, other.lat, other.lng);
      const isClose = dist <= 50;

      if (samePole || isClose) {
        visited.add(other.id);
        cluster.push(other);
      }
    }

    // Select primary report: prioritize critical, then urgent, then highest verification count
    cluster.sort((a, b) => {
      const tierScore = (t: HazardTier) => (t === "critical" ? 3 : t === "urgent" ? 2 : 1);
      const diff = tierScore(b.hazard_tier) - tierScore(a.hazard_tier);
      if (diff !== 0) return diff;
      return b.verification_count - a.verification_count;
    });

    const primary = cluster[0]!;
    const duplicates = cluster.slice(1);
    const totalConfirmations = cluster.reduce((sum, item) => sum + item.verification_count, 0);

    groups.push({
      primary,
      duplicates,
      totalReports: cluster.length,
      totalConfirmations,
      poleNumber: primary.pole_number || duplicates.find((d) => d.pole_number)?.pole_number || null,
      landmark: primary.landmark || duplicates.find((d) => d.landmark)?.landmark || null,
      hasCritical: cluster.some((c) => c.hazard_tier === "critical"),
    });
  }

  // Sort groups: Critical first, then urgent, then low, then newest
  return groups.sort((a, b) => {
    const score = (t: HazardTier) => (t === "critical" ? 3 : t === "urgent" ? 2 : 1);
    const diff = score(b.primary.hazard_tier) - score(a.primary.hazard_tier);
    if (diff !== 0) return diff;
    return new Date(b.primary.created_at).getTime() - new Date(a.primary.created_at).getTime();
  });
}
