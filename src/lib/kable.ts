export type HazardTier = "critical" | "urgent" | "low";
export type ReportStatus = "reported" | "dispatched" | "repairing" | "resolved";
export type AppRole = "citizen" | "dispatcher" | "tanod";

export interface HazardReport {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  hazard_tier: HazardTier;
  status: ReportStatus;
  verification_count: number;
  photo_url: string | null;
  landmark: string | null;
  pole_number: string | null;
  assigned_crew: string | null;
  is_tanod_verified: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const HAZARD_TIERS: {
  tier: HazardTier;
  label: string;
  dot: string;
  title: string;
  examples: string;
  colorVar: string;
  bgHex: string;
  fgHex: string;
  badgeClass: string;
}[] = [
  {
    tier: "critical",
    label: "Critical Danger",
    dot: "🔴",
    title: "Downed Live Wires / Active Sparks",
    examples: "Downed live wire lying on road, sparking transformer, wire submerged in puddle or canal.",
    colorVar: "var(--tier-critical)",
    bgHex: "#ef4444",
    fgHex: "#fee2e2",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/40",
  },
  {
    tier: "urgent",
    label: "Urgent Risk",
    dot: "🟠",
    title: "Damaged / Tilted Utility Pole",
    examples: "Tilted concrete or wooden pole, cracked crossarm, transformer leaning over roadway.",
    colorVar: "var(--tier-urgent)",
    bgHex: "#f97316",
    fgHex: "#ffedd5",
    badgeClass: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  },
  {
    tier: "low",
    label: "Low Risk",
    dot: "🟡",
    title: "Sagging Telecom / Low Cable",
    examples: "Sagging fiber or cable TV wire, non-energized dangling line, encroaching tree branches.",
    colorVar: "var(--tier-low)",
    bgHex: "#eab308",
    fgHex: "#fef9c3",
    badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  },
];

export const TIER_COLOR: Record<HazardTier, string> = {
  critical: "var(--tier-critical)",
  urgent: "var(--tier-urgent)",
  low: "var(--tier-low)",
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  reported: "Reported / Pending",
  dispatched: "Crew Dispatched",
  repairing: "Repair in Progress",
  resolved: "Fixed & Cleared",
};

export const STATUS_FLOW: ReportStatus[] = ["reported", "dispatched", "repairing", "resolved"];

export const XP_REPORT = 50;
export const XP_VALIDATION = 20;

export const CIVIC_TIERS: { name: string; min: number; description: string; badge: string }[] = [
  { name: "Purok Scout", min: 0, description: "Active citizen spotting village line hazards", badge: "🌱" },
  { name: "Tanod Specialist", min: 250, description: "Trusted community surveyor & verifier", badge: "🛡️" },
  { name: "Lineman Deputy", min: 1000, description: "Senior safety partner coordinating with BUSECO", badge: "⚡" },
  { name: "Master Lineman", min: 2500, description: "Municipal hero leading provincial disaster restoration", badge: "🏆" },
];

export function civicTier(xp: number) {
  let current = CIVIC_TIERS[0]!;
  for (const t of CIVIC_TIERS) if (xp >= t.min) current = t;
  const next = CIVIC_TIERS.find((t) => t.min > xp);
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(100, Math.round(((xp - current.min) / span) * 100)) : 100;
  return {
    name: current.name,
    badge: current.badge,
    description: current.description,
    next: next?.name ?? null,
    nextAt: next?.min ?? null,
    progress,
  };
}

export interface CivicBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  criteria: string;
  unlocked: boolean;
}

export function calculateBadges(xp: number, reportCount: number, voteCount: number, hasPoleNumberReport: boolean): CivicBadge[] {
  return [
    {
      id: "first_responder",
      name: "First Responder",
      icon: "🚨",
      description: "Quickly logged a critical electrical hazard before an accident happened.",
      criteria: "Submit at least 1 hazard report",
      unlocked: reportCount >= 1,
    },
    {
      id: "stencil_hero",
      name: "Stencil Hero",
      icon: "🏷️",
      description: "Logged concrete pole stencil numbers (e.g. BUSECO-1234) for rapid asset discovery.",
      criteria: "Submit a report with an official pole stencil number",
      unlocked: hasPoleNumberReport,
    },
    {
      id: "community_guardian",
      name: "Community Guardian",
      icon: "🛡️",
      description: "Active neighborhood verifier confirming still-broken or resolved lines.",
      criteria: "Confirm or validate 3+ community hazard reports",
      unlocked: voteCount >= 3,
    },
    {
      id: "storm_patrol",
      name: "Storm Patrol",
      icon: "⛈️",
      description: "Scouted and flagged line breaks during heavy monsoon or typhoon season.",
      criteria: "Earn 150+ civic XP during active field operations",
      unlocked: xp >= 150,
    },
    {
      id: "master_deputy",
      name: "Lineman Deputy Pin",
      icon: "🎖️",
      description: "Reached official Lineman Deputy rank in partnership with BUSECO coop.",
      criteria: "Reach 1,000 XP threshold",
      unlocked: xp >= 1000,
    },
  ];
}

export interface RewardItem {
  id: string;
  title: string;
  category: "utility_bill" | "raffle" | "gear";
  provider: string;
  costXp: number;
  discountPeso: number;
  description: string;
  badge: string;
}

export const REWARDS_CATALOG: RewardItem[] = [
  {
    id: "buseco-50",
    title: "₱50 BUSECO Electric Bill Credit",
    category: "utility_bill",
    provider: "BUSECO Electric Cooperative",
    costXp: 150,
    discountPeso: 50,
    description: "Direct ₱50 credit deducted from your monthly electric power billing invoice.",
    badge: "⚡ ₱50 Bill Off",
  },
  {
    id: "buseco-100",
    title: "₱100 BUSECO Electric Bill Credit",
    category: "utility_bill",
    provider: "BUSECO Electric Cooperative",
    costXp: 280,
    discountPeso: 100,
    description: "Generous ₱100 power rebate applied to consumer electric billing account.",
    badge: "⚡ ₱100 Bill Off",
  },
  {
    id: "raffle-safety",
    title: "Purok Safety Month Raffle Ticket",
    category: "raffle",
    provider: "LGU Barangay Disaster Council",
    costXp: 50,
    discountPeso: 25,
    description: "Entry ticket for the municipal safety raffle: win solar lights, power banks & grocery vouchers.",
    badge: "🎟️ Raffle Entry",
  },
  {
    id: "lineman-kit",
    title: "Lineman First-Response Emergency Kit",
    category: "gear",
    provider: "BUSECO & Civic Partners",
    costXp: 500,
    discountPeso: 250,
    description: "High-visibility rain jacket, heavy-duty insulated flashlight, and emergency power battery.",
    badge: "🔦 Safety Gear",
  },
];

export interface ClaimedVoucher {
  id: string;
  code: string;
  rewardId: string;
  title: string;
  discountPeso: number;
  userId: string;
  userName: string;
  createdAt: string;
  status: "active" | "applied_to_bill";
  appliedAt?: string;
  appliedAccountNo?: string;
  appliedBy?: string;
}

export function generateVoucherCode(prefix: string = "BUSECO"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 5; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${random}`;
}

export const DISPATCH_CREWS = [
  { id: "crew-alpha", name: "Crew Alpha - Bukidnon Sector 1 (Sayre Highway)", vehicle: "Bucket Truck #04", leader: "Lineman E. Mendoza" },
  { id: "crew-bravo", name: "Crew Bravo - Malaybalay Quick-Response", vehicle: "Patrol Pickup #07", leader: "Lineman R. Villanueva" },
  { id: "crew-charlie", name: "Crew Charlie - Manolo Fortich Heavy Unit", vehicle: "Crane Truck #02", leader: "Supervisor D. Santos" },
  { id: "crew-delta", name: "Crew Delta - Barangay Tanod Safety Escort", vehicle: "Barangay Patrol Multi-cab", leader: "Officer B. Macas" },
];

/**
 * Haversine formula to compute distance in meters between two coordinates.
 */
export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
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
