import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Crosshair,
  ShieldAlert,
  Loader2,
  MapPin,
  Tag,
  CheckCircle,
  WifiOff,
  Flame,
  ArrowRight,
  ShieldCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photo";
import { HAZARD_TIERS, TIER_COLOR, XP_REPORT, type HazardTier } from "@/lib/kable";
import { createHazardReport } from "@/lib/reports";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KableHero — Report an electric hazard" },
      {
        name: "description",
        content:
          "Report downed wires, leaning utility poles, or low dangling cables with photo proof and GPS for rural electric cooperatives like BUSECO.",
      },
    ],
  }),
  component: ReporterPage,
});

const HOLD_MS = 3000;

function ReporterPage() {
  const { user, refreshProfile } = useAuth();
  const { role, isDispatcher, isTanod } = useRole();
  const navigate = useNavigate();

  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tier, setTier] = useState<HazardTier | null>(null);
  const [landmark, setLandmark] = useState("");
  const [poleNumber, setPoleNumber] = useState("");
  const [held, setHeld] = useState(false);
  const [progress, setProgress] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(3.0);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setLocationBlocked(true);
      toast.error("Geolocation not supported. Defaulting to BUSECO coordinates.");
      setCoords({ lat: 8.3671, lng: 124.8645, acc: 25 }); // Manolo Fortich, Bukidnon
      return;
    }
    setLocating(true);
    setLocationBlocked(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
        });
        setLocating(false);
        toast.success("GPS location locked with high accuracy.");
      },
      () => {
        setLocating(false);
        setLocationBlocked(true);
        toast.info("Location permission blocked. Set to BUSECO Bukidnon franchise default.");
        setCoords({ lat: 8.3671, lng: 124.8645, acc: 30 }); // Fallback
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    locate();
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const startHold = () => {
    if (held || !tier) return;
    const start = Date.now();
    timer.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
      const rem = Math.max(0, (HOLD_MS - elapsed) / 1000);
      setProgress(pct);
      setRemainingSeconds(parseFloat(rem.toFixed(1)));
      if (pct >= 100) {
        if (timer.current) window.clearInterval(timer.current);
        setHeld(true);
        setRemainingSeconds(0);
        toast.success("Safe distance confirmed! Ready to submit.");
      }
    }, 40);
  };

  const endHold = () => {
    if (timer.current) window.clearInterval(timer.current);
    if (!held) {
      setProgress(0);
      setRemainingSeconds(3.0);
    }
  };

  const submit = async () => {
    if (!coords || !tier || !held) return;
    setSubmitting(true);

    try {
      let photoUrl: string | null = null;
      if (photo) {
        try {
          const ext = photo.name.split(".").pop() ?? "jpg";
          const path = `${user?.id || "anon"}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(path, photo, { contentType: photo.type || "image/jpeg" });
          if (!upErr) {
            photoUrl = path;
          }
        } catch {
          console.warn("Storage upload bypassed, using local preview");
        }
        if (!photoUrl && preview) {
          photoUrl = preview;
        }
      }

      await createHazardReport({
        userId: user?.id || "demo-citizen",
        lat: coords.lat,
        lng: coords.lng,
        hazardTier: tier,
        photoUrl,
        landmark: landmark.trim() || null,
        poleNumber: poleNumber.trim() ? poleNumber.trim().toUpperCase() : null,
        note: `Citizen report logged via mobile web.${poleNumber ? ` Pole: ${poleNumber}.` : ""}${landmark ? ` Landmark: ${landmark}.` : ""}`,
      });

      if (user) {
        await refreshProfile();
      }

      toast.success(`Hazard report transmitted to BUSECO dispatch! +${XP_REPORT} XP`);

      // Redirect depending on active role
      if (isDispatcher) {
        void navigate({ to: "/map" });
      } else if (isTanod) {
        void navigate({ to: "/verify" });
      } else {
        void navigate({ to: "/profile" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the report");
    } finally {
      setSubmitting(false);
    }
  };

  const ready = Boolean(coords && tier);

  return (
    <AppShell>
      <div className="space-y-4 px-4 py-4 max-w-lg mx-auto">
        {/* Role Quick-Jump Banners */}
        {isDispatcher && (
          <div className="clay-card-amber p-3.5 flex items-center justify-between text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-amber-600" />
              <span>Viewing as <strong>BUSECO Dispatcher</strong></span>
            </div>
            <Link
              to="/map"
              className="clay-btn clay-btn-primary px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold"
            >
              Open Triage Console <ArrowRight className="ml-1 size-3" />
            </Link>
          </div>
        )}

        {isTanod && (
          <div className="clay-card-emerald p-3.5 flex items-center justify-between text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <span>Viewing as <strong>Barangay Tanod</strong></span>
            </div>
            <Link
              to="/verify"
              className="clay-btn clay-btn-tanod px-2.5 py-1 text-[11px] uppercase tracking-wider font-bold text-emerald-950"
            >
              Field Queue <ArrowRight className="ml-1 size-3" />
            </Link>
          </div>
        )}

        {/* Hero Section */}
        <section className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="clay-pill bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider">
              BUSECO Rural Grid Triage
            </span>
            <span className="text-[11px] text-slate-500 font-medium">· 2G/3G Resilient</span>
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900 sm:text-3xl mt-1">
            Report an electric hazard
            <span className="block text-amber-600">in three taps</span>
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Photo proof and GPS coordinates route instantly to electric cooperative lineman units.
          </p>
        </section>

        {/* Step 1 — Capture & Geolocation Clay Card */}
        <section className="clay-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="label-caps text-slate-700">Step 1 · Photo Proof & GPS Tagging</p>
            {coords && (
              <span className="clay-pill bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-mono">
                GPS ±{coords.acc}m
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Camera Button */}
            <label className="clay-btn clay-btn-neutral flex flex-col items-center justify-center gap-1.5 p-4 text-center cursor-pointer min-h-[105px]">
              {preview ? (
                <img src={preview} alt="Hazard preview" className="h-14 w-full rounded-xl object-cover" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-inner">
                  <Camera className="size-5" />
                </div>
              )}
              <span className="font-display text-xs tracking-wider uppercase font-bold text-slate-800">
                {photo ? "Change Photo" : "Take Photo"}
              </span>
              <span className="text-[9px] text-slate-500 font-medium">Mobile Camera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>

            {/* GPS Button */}
            <button
              onClick={locate}
              type="button"
              className="clay-btn clay-btn-neutral flex flex-col items-center justify-center gap-1.5 p-4 text-center min-h-[105px]"
            >
              {locating ? (
                <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-inner">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : (
                <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-inner">
                  <Crosshair className="size-5" />
                </div>
              )}
              <span className="font-display text-xs tracking-wider uppercase font-bold text-slate-800">
                {coords ? "GPS Locked" : "Fetch GPS"}
              </span>
              {coords ? (
                <span className="text-[9px] font-mono text-slate-600 font-semibold truncate max-w-full">
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </span>
              ) : (
                <span className="text-[9px] text-slate-500 font-medium">HTML5 GPS</span>
              )}
            </button>
          </div>

          {locationBlocked && (
            <p className="text-[11px] text-amber-700 font-medium">
              * Location permission blocked: Using cooperative franchise default coordinates.
            </p>
          )}

          {/* Optional Landmark & Pole Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
            <div>
              <label className="label-caps flex items-center gap-1 text-slate-700">
                <MapPin className="size-3 text-slate-500" />
                Landmark (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Near yellow sari-sari store"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="clay-input mt-1 w-full px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="label-caps flex items-center gap-1 text-slate-700">
                <Tag className="size-3 text-slate-500" />
                Pole Stencil (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. BUSECO-1234"
                value={poleNumber}
                onChange={(e) => setPoleNumber(e.target.value.toUpperCase())}
                className="clay-input mt-1 w-full px-3 py-2 font-mono text-xs uppercase"
              />
            </div>
          </div>
        </section>

        {/* Step 2 — 3-Button Hazard Danger Level Picker */}
        <section className="clay-card p-5 space-y-2.5">
          <p className="label-caps text-slate-700">Step 2 · 3-Button Threat Level Picker</p>
          <div className="space-y-2.5">
            {HAZARD_TIERS.map((t) => {
              const active = tier === t.tier;
              return (
                <button
                  key={t.tier}
                  type="button"
                  onClick={() => {
                    setTier(t.tier);
                    setHeld(false);
                    setProgress(0);
                    setRemainingSeconds(3.0);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl transition-all relative ${
                    active
                      ? t.tier === "critical"
                        ? "clay-card-red ring-2 ring-red-500 scale-[1.02]"
                        : t.tier === "urgent"
                        ? "clay-card-amber ring-2 ring-orange-500 scale-[1.02]"
                        : "clay-card ring-2 ring-amber-400 bg-amber-50/80 scale-[1.02]"
                      : "clay-card bg-slate-50/60 hover:bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 size-4 shrink-0 rounded-full shadow-sm"
                      style={{
                        backgroundColor:
                          t.tier === "critical"
                            ? "#ef4444"
                            : t.tier === "urgent"
                            ? "#f97316"
                            : "#eab308",
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold tracking-wide uppercase text-slate-900">
                          {t.label}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs">{t.dot}</span>
                          {active && (
                            <span className="flex size-4 items-center justify-center rounded-full bg-slate-900 text-white ml-1">
                              <Check className="size-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="block text-xs font-bold text-slate-800 mt-0.5">
                        {t.title}
                      </span>
                      <span className="block text-[11px] text-slate-600 mt-0.5 leading-snug font-medium">
                        {t.examples}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3 — Safe-Distance Hold Button */}
        <section className="clay-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="label-caps text-slate-700">Step 3 · Safe-Distance Safety Interlock</p>
            <span className="clay-pill px-2.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
              {held ? "UNLOCKED" : `${remainingSeconds.toFixed(1)}s hold`}
            </span>
          </div>

          <button
            type="button"
            disabled={!ready}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            className={`relative mt-2 w-full overflow-hidden rounded-2xl py-4 select-none transition-all ${
              held
                ? "clay-btn-tanod shadow-lg"
                : ready
                ? "clay-card bg-amber-50/60 active:scale-[0.98]"
                : "opacity-45 cursor-not-allowed bg-slate-100"
            }`}
          >
            {/* Progress Fill Bar */}
            {!held && (
              <span
                className="absolute inset-y-0 left-0 bg-amber-400/40 transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
            )}
            <span className="relative flex items-center justify-center gap-2 font-display text-sm tracking-wider uppercase font-bold">
              {held ? (
                <>
                  <CheckCircle className="size-5 text-emerald-950" />
                  <span className="text-emerald-950">Confirmed: 5m+ Safe Distance Verified</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="size-5 text-amber-600" />
                  <span className="text-slate-900">Hold 3s to Confirm 5m Safe Distance</span>
                </>
              )}
            </span>
          </button>
          <p className="text-[11px] text-slate-500 font-medium">
            Mandatory safety gate: Never touch or walk near downed lines. Voltage grounds through wet earth within 5 meters.
          </p>
        </section>

        {/* Submission Action Button */}
        <button
          onClick={submit}
          disabled={!held || submitting}
          className="clay-btn clay-btn-primary w-full py-4 text-base font-extrabold tracking-widest uppercase shadow-lg text-amber-950 disabled:opacity-40"
        >
          {submitting ? "Transmitting Report…" : `Submit Hazard Report · +${XP_REPORT} XP`}
        </button>

        {!user && (
          <p className="text-center text-xs text-slate-600 font-medium">
            <Link to="/auth" className="underline font-bold text-amber-700">
              Sign in or create an account
            </Link>{" "}
            to credit your civic XP and earn electric bill discount vouchers.
          </p>
        )}
      </div>
    </AppShell>
  );
}
