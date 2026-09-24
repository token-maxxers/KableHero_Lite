export type HazardTier = "critical" | "urgent" | "low";
export type ReportStatus = "reported" | "dispatched" | "resolved";
export type AppRole = "citizen" | "dispatcher" | "tanod";

export const HAZARD_TIERS: {
  tier: HazardTier;
  label: string;
  dot: string;
  examples: string;
  colorVar: string;
}[] = [
  {
    tier: "critical",
    label: "Critical",
    dot: "🔴",
    examples: "Downed live wire, wire in water or across a path",
    colorVar: "var(--tier-critical)",
  },
  {
    tier: "urgent",
    label: "Urgent",
    dot: "🟠",
    examples: "Leaning pole, damaged or arcing transformer",
    colorVar: "var(--tier-urgent)",
  },
  {
    tier: "low",
    label: "Low",
    dot: "🟡",
    examples: "Dangling telecom cable, encroaching branches",
    colorVar: "var(--tier-low)",
  },
];

export const TIER_COLOR: Record<HazardTier, string> = {
  critical: "var(--tier-critical)",
  urgent: "var(--tier-urgent)",
  low: "var(--tier-low)",
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  reported: "Reported",
  dispatched: "Dispatched",
  resolved: "Resolved",
};

export const STATUS_FLOW: ReportStatus[] = ["reported", "dispatched", "resolved"];

export const XP_REPORT = 50;
export const XP_VALIDATION = 20;

export const CIVIC_TIERS: { name: string; min: number }[] = [
  { name: "Purok Scout", min: 0 },
  { name: "Tanod Specialist", min: 250 },
  { name: "Master Lineman", min: 1000 },
];

export function civicTier(xp: number) {
  let current = CIVIC_TIERS[0]!;
  for (const t of CIVIC_TIERS) if (xp >= t.min) current = t;
  const next = CIVIC_TIERS.find((t) => t.min > xp);
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(100, Math.round(((xp - current.min) / span) * 100)) : 100;
  return { name: current.name, next: next?.name ?? null, nextAt: next?.min ?? null, progress };
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
