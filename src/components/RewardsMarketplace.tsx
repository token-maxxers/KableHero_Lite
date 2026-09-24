import React, { useState } from "react";
import {
  Award,
  Zap,
  Ticket,
  ShieldCheck,
  Copy,
  Check,
  Gift,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  REWARDS_CATALOG,
  RewardItem,
  ClaimedVoucher,
  civicTier,
  calculateBadges,
  CivicBadge,
  timeAgo,
} from "@/lib/kable";
import { claimVoucher, getStoredVouchers } from "@/lib/vouchers";

interface RewardsMarketplaceProps {
  xp: number;
  userName: string;
  userId: string;
  reportCount: number;
  voteCount: number;
  hasPoleNumberReport: boolean;
  onXpChange?: (newXp: number) => void;
}

export function RewardsMarketplace({
  xp,
  userName,
  userId,
  reportCount,
  voteCount,
  hasPoleNumberReport,
  onXpChange,
}: RewardsMarketplaceProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [vouchersVersion, setVouchersVersion] = useState(0);

  const badges = calculateBadges(xp, reportCount, voteCount, hasPoleNumberReport);
  const userVouchers = getStoredVouchers().filter((v) => v.userId === userId || v.userId === "demo-user-1");

  const handleRedeem = (item: RewardItem) => {
    if (xp < item.costXp) {
      toast.error(`You need ${item.costXp - xp} more XP to redeem this reward.`);
      return;
    }

    const res = claimVoucher(item.id, userId, userName);
    if (!res.success || !res.voucher) {
      toast.error(res.error || "Redemption failed");
      return;
    }

    const newXp = Math.max(0, xp - item.costXp);
    onXpChange?.(newXp);
    setVouchersVersion((v) => v + 1);

    toast.success(`Redeemed! Voucher code: ${res.voucher.code}. Credit ready for BUSECO billing.`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied code ${code} to clipboard`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Badges Showcase Section */}
      <section className="clay-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-inner">
              <Award className="size-4" />
            </div>
            <h3 className="font-display text-base font-bold uppercase tracking-wider text-slate-900">
              Safety & Storm Badges
            </h3>
          </div>
          <span className="clay-pill bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-bold">
            {badges.filter((b) => b.unlocked).length} / {badges.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`p-3 rounded-2xl transition-all ${
                b.unlocked
                  ? "clay-card bg-amber-50/60 border-amber-200"
                  : "clay-card bg-slate-50/50 opacity-60"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-2xl drop-shadow-sm">{b.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold tracking-wide uppercase text-slate-900">
                      {b.name}
                    </span>
                    {b.unlocked ? (
                      <span className="clay-pill bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[9px] uppercase font-bold">
                        Earned
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Locked</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 font-medium">{b.description}</p>
                  <p className="mt-1 text-[10px] font-mono text-slate-500 font-semibold">
                    Target: {b.criteria}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards Catalog */}
      <section className="clay-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shadow-inner">
              <Gift className="size-4" />
            </div>
            <h3 className="font-display text-base font-bold uppercase tracking-wider text-slate-900">
              Civic Rewards Marketplace
            </h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium">Balance: </span>
            <span className="font-display text-sm font-extrabold text-amber-700">{xp} XP</span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          Convert your verified reporting XP into direct Philippine cooperative electric bill discounts or safety raffle entries.
        </p>

        <div className="grid grid-cols-1 gap-3">
          {REWARDS_CATALOG.map((item) => {
            const canAfford = xp >= item.costXp;
            return (
              <div
                key={item.id}
                className="clay-card bg-slate-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-100"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="clay-pill bg-emerald-100 text-emerald-800 px-2 py-0.5 font-display text-[10px] font-bold uppercase">
                      {item.badge}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">{item.provider}</span>
                  </div>
                  <h4 className="font-display text-base font-bold text-slate-900 uppercase">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">{item.description}</p>
                </div>

                <div className="flex sm:flex-col items-center justify-between sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                  <span className="font-display text-base font-extrabold text-amber-700">
                    {item.costXp} XP
                  </span>
                  <button
                    onClick={() => handleRedeem(item)}
                    disabled={!canAfford}
                    className={`clay-btn px-4 py-2 text-xs font-bold tracking-wider uppercase ${
                      canAfford ? "clay-btn-primary" : "clay-btn-neutral opacity-50"
                    }`}
                  >
                    {canAfford ? "Redeem" : `Need ${item.costXp - xp} XP`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Claimed Vouchers Drawer/List */}
      <section className="clay-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-inner">
              <Ticket className="size-4" />
            </div>
            <h3 className="font-display text-base font-bold uppercase tracking-wider text-slate-900">
              Claimed Vouchers ({userVouchers.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Present at BUSECO billing</span>
        </div>

        {userVouchers.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 font-medium">
            You haven't claimed any vouchers yet. Earn XP by reporting electrical hazards to unlock bill discounts.
          </div>
        ) : (
          <div className="space-y-2.5">
            {userVouchers.map((v) => {
              const isApplied = v.status === "applied_to_bill";
              return (
                <div
                  key={v.id}
                  className="clay-card bg-white p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-100"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider text-amber-700">
                        {v.code}
                      </span>
                      {isApplied ? (
                        <span className="clay-pill bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold uppercase">
                          ✓ Applied to Bill
                        </span>
                      ) : (
                        <span className="clay-pill bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                          Active · Ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800">{v.title}</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Issued {timeAgo(v.createdAt)}
                      {v.appliedAccountNo && ` · Applied to Acc #${v.appliedAccountNo}`}
                    </p>
                  </div>

                  <button
                    onClick={() => copyCode(v.code)}
                    className="clay-btn clay-btn-neutral px-3 py-1.5 text-xs tracking-wider uppercase font-bold text-slate-700 w-full sm:w-auto"
                  >
                    {copiedCode === v.code ? (
                      <>
                        <Check className="mr-1 size-3.5 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 size-3.5" /> Copy Code
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
