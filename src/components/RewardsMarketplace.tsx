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
    <div className="space-y-6">
      {/* Badges Showcase Section */}
      <section className="panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-primary" />
            <h3 className="font-display text-base font-semibold uppercase tracking-wider">
              Safety & Storm-Response Badges
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {badges.filter((b) => b.unlocked).length} / {badges.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-lg border p-3 transition-colors ${
                b.unlocked
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-muted/20 opacity-60"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-2xl">{b.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-semibold tracking-wide uppercase text-foreground">
                      {b.name}
                    </span>
                    {b.unlocked ? (
                      <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary uppercase">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground uppercase">Locked</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.description}</p>
                  <p className="mt-1 text-[10px] font-mono text-muted-foreground/80">
                    Target: {b.criteria}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards Catalog */}
      <section className="panel p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="size-5 text-accent" />
            <h3 className="font-display text-base font-semibold uppercase tracking-wider">
              Civic Rewards Marketplace
            </h3>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Available balance: </span>
            <span className="font-display text-sm font-bold text-primary">{xp} XP</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Convert your verified reporting XP into direct Philippine cooperative electric bill discounts or safety raffle entries.
        </p>

        <div className="grid grid-cols-1 gap-3">
          {REWARDS_CATALOG.map((item) => {
            const canAfford = xp >= item.costXp;
            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-surface/50 p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-display text-xs font-semibold text-emerald-300 uppercase">
                      {item.badge}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{item.provider}</span>
                  </div>
                  <h4 className="font-display text-base font-semibold text-foreground uppercase">
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>

                <div className="flex sm:flex-col items-center justify-between sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                  <div className="text-right">
                    <span className="font-display text-base font-bold text-primary">
                      {item.costXp} XP
                    </span>
                  </div>
                  <button
                    onClick={() => handleRedeem(item)}
                    disabled={!canAfford}
                    className="rounded-md bg-primary px-4 py-2 font-display text-xs font-semibold tracking-wider text-primary-foreground uppercase disabled:opacity-40 disabled:hover:bg-primary transition-colors"
                  >
                    {canAfford ? "Redeem Reward" : `Need ${item.costXp - xp} XP`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Claimed Vouchers Drawer/List */}
      <section className="panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="size-5 text-emerald-400" />
            <h3 className="font-display text-base font-semibold uppercase tracking-wider">
              My Claimed Vouchers ({userVouchers.length})
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">Present to BUSECO billing desk</span>
        </div>

        {userVouchers.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            You haven't claimed any vouchers yet. Earn XP by reporting electrical hazards to unlock bill discounts.
          </div>
        ) : (
          <div className="space-y-2.5">
            {userVouchers.map((v) => {
              const isApplied = v.status === "applied_to_bill";
              return (
                <div
                  key={v.id}
                  className="rounded-lg border border-border bg-background/80 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider text-primary">
                        {v.code}
                      </span>
                      {isApplied ? (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                          ✓ Applied to Bill
                        </span>
                      ) : (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                          Active · Ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-foreground">{v.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Issued {timeAgo(v.createdAt)}
                      {v.appliedAccountNo && ` · Applied to Acc #${v.appliedAccountNo}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => copyCode(v.code)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs font-display tracking-wider uppercase hover:bg-muted"
                    >
                      {copiedCode === v.code ? (
                        <>
                          <Check className="size-3.5 text-emerald-400" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
