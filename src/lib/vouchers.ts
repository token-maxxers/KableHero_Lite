import { ClaimedVoucher, REWARDS_CATALOG, generateVoucherCode } from "./kable";

const LOCAL_STORAGE_VOUCHERS_KEY = "kablehero_vouchers_cache_v1";

// Demo vouchers for presentation testing
export const SEED_VOUCHERS: ClaimedVoucher[] = [
  {
    id: "vouch-001",
    code: "BUSECO-50-H7P2X",
    rewardId: "buseco-50",
    title: "₱50 BUSECO Electric Bill Credit",
    discountPeso: 50,
    userId: "demo-user-1",
    userName: "Juan dela Cruz (Purok Scout)",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    status: "active",
  },
  {
    id: "vouch-002",
    code: "BUSECO-100-M3K9Q",
    rewardId: "buseco-100",
    title: "₱100 BUSECO Electric Bill Credit",
    discountPeso: 100,
    userId: "demo-user-2",
    userName: "Maria Santos (Tanod Specialist)",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: "applied_to_bill",
    appliedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    appliedAccountNo: "BUSECO-ACC-881920",
    appliedBy: "BUSECO Cashier Desk #2",
  },
];

export function getStoredVouchers(): ClaimedVoucher[] {
  if (typeof window === "undefined") return SEED_VOUCHERS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VOUCHERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_VOUCHERS_KEY, JSON.stringify(SEED_VOUCHERS));
      return SEED_VOUCHERS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_VOUCHERS;
  }
}

export function saveStoredVouchers(vouchers: ClaimedVoucher[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_VOUCHERS_KEY, JSON.stringify(vouchers));
    window.dispatchEvent(new CustomEvent("kablehero_vouchers_updated"));
  } catch (err) {
    console.warn("Failed to save vouchers to local storage:", err);
  }
}

/**
 * Claims a new voucher for the citizen, deducting XP.
 */
export function claimVoucher(
  rewardId: string,
  userId: string,
  userName: string
): { success: boolean; voucher?: ClaimedVoucher; error?: string } {
  const item = REWARDS_CATALOG.find((r) => r.id === rewardId);
  if (!item) {
    return { success: false, error: "Reward item not found" };
  }

  const prefix = item.category === "utility_bill" ? `BUSECO-${item.discountPeso}` : "RAFFLE";
  const code = generateVoucherCode(prefix);

  const newVoucher: ClaimedVoucher = {
    id: `vouch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    code,
    rewardId: item.id,
    title: item.title,
    discountPeso: item.discountPeso,
    userId,
    userName,
    createdAt: new Date().toISOString(),
    status: "active",
  };

  const current = getStoredVouchers();
  saveStoredVouchers([newVoucher, ...current]);

  return { success: true, voucher: newVoucher };
}

/**
 * Utility Billing Officer verifies and marks a voucher as applied to consumer's electric bill.
 */
export function applyVoucherToElectricBill(
  code: string,
  consumerAccountNo: string,
  officerName: string = "BUSECO Billing Desk"
): { success: boolean; voucher?: ClaimedVoucher; error?: string } {
  const cleanCode = code.trim().toUpperCase();
  const current = getStoredVouchers();
  const index = current.findIndex((v) => v.code.toUpperCase() === cleanCode);

  if (index === -1) {
    return { success: false, error: `Voucher code '${cleanCode}' does not exist in the cooperative registry.` };
  }

  const target = current[index]!;
  if (target.status === "applied_to_bill") {
    return {
      success: false,
      error: `Voucher '${cleanCode}' was ALREADY redeemed on ${new Date(target.appliedAt || "").toLocaleDateString()} for Account #${target.appliedAccountNo || "N/A"}.`,
    };
  }

  const updated: ClaimedVoucher = {
    ...target,
    status: "applied_to_bill",
    appliedAt: new Date().toISOString(),
    appliedAccountNo: consumerAccountNo.trim().toUpperCase(),
    appliedBy: officerName,
  };

  current[index] = updated;
  saveStoredVouchers(current);

  return { success: true, voucher: updated };
}

/**
 * Searches a voucher by code.
 */
export function lookupVoucher(code: string): ClaimedVoucher | null {
  const cleanCode = code.trim().toUpperCase();
  const current = getStoredVouchers();
  return current.find((v) => v.code.toUpperCase() === cleanCode) || null;
}
