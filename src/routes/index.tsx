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
      { property: "og:title", content: "KableHero — Report an electric hazard" },
      {
        property: "og:description",
        content: "Provincial crowdsourced electric hazard reporting for Philippine communities.",
      },
    ],
  }),
  component: ReporterPage,
});

const HOLD_MS = 3000;

function ReporterPage() {
  const { user, refreshProfile } = useAuth();
  const { isAdmin } = useRole();
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
      toast.error("This browser can't share its location. Using default coop coordinates.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Try uploading to Supabase storage
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
          // If storage bucket is not configured, fall back to object preview URL or null
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
      void navigate({ to: "/map" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the report");
    } finally {
      setSubmitting(false);
    }
  };

  const ready = Boolean(coords && tier);

  return (
    <AppShell>
      <div className="space-y-4 px-4 py-4">
        {/* Admin Mode Shortcut Banner */}
        {isAdmin && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-amber-400" />
              <span>You are viewing as <strong>BUSECO Dispatch Admin</strong>.</span>
            </div>
            <Link
              to="/map"
              className="flex items-center gap-1 font-display uppercase tracking-wider text-amber-300 underline font-bold"
            >
              Open Live Console <ArrowRight className="size-3" />
            </Link>
          </div>
        )}

        {/* Hero Title */}
        <section>
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary/20 px-2 py-0.5 font-display text-[10px] tracking-wider text-primary uppercase font-bold">
              BUSECO Rural Grid Triage
            </span>
            <span className="text-[11px] text-muted-foreground">· 2G/3G Resilient</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
            Report an electric hazard
            <span className="block text-primary">in three taps</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            No heavy app downloads. One-tap photo and GPS coordinates route instantly to cooperative emergency crews.
          </p>
        </section>

        {/* Step 1 — Capture & Geolocation */}
        <section className="panel p-4 space-y-3">
          <p className="label-caps">Step 1 · Photo Proof & GPS Tagging</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-4 text-center hover:bg-muted/30 transition-colors">
              {preview ? (
                <img src={preview} alt="Hazard preview" className="h-16 w-full rounded object-cover" />
              ) : (
                <Camera className="size-6 text-primary" />
              )}
              <span className="font-display text-xs tracking-wider uppercase font-semibold">
                {photo ? "Change Photo" : "Take Photo"}
              </span>
              <span className="text-[10px] text-muted-foreground">Native device camera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              onClick={locate}
              type="button"
              className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-2 py-4 text-center hover:bg-muted/30 transition-colors"
            >
              {locating ? (
                <Loader2 className="size-6 animate-spin text-accent" />
              ) : (
                <Crosshair className="size-6 text-accent" />
              )}
              <span className="font-display text-xs tracking-wider uppercase font-semibold">
                {coords ? "GPS Locked" : "Fetch GPS"}
              </span>
              {coords ? (
                <span className="text-[10px] font-mono text-muted-foreground">
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)} (±{coords.acc}m)
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">HTML5 Geolocation</span>
              )}
            </button>
          </div>

          {locationBlocked && (
            <p className="text-[11px] text-amber-300">
              * Location permission blocked: Using cooperative franchise default coordinates.
            </p>
          )}

          {/* Optional Landmark & Pole Number (Lightweight helpers) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border">
            <div>
              <label className="label-caps flex items-center gap-1">
                <MapPin className="size-3 text-muted-foreground" />
                Landmark (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Near yellow sari-sari store"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="label-caps flex items-center gap-1">
                <Tag className="size-3 text-muted-foreground" />
                Pole Number Stencil (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. BUSECO-1234"
                value={poleNumber}
                onChange={(e) => setPoleNumber(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs uppercase outline-none focus:border-ring"
              />
            </div>
          </div>
        </section>

        {/* Step 2 — 3-Button Threat Level Picker */}
        <section className="panel p-4 space-y-2.5">
          <p className="label-caps">Step 2 · 3-Button Danger Level Picker</p>
          <div className="space-y-2">
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
                  className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all"
                  style={{
                    borderColor: active ? TIER_COLOR[t.tier] : "var(--border)",
                    backgroundColor: active
                      ? "color-mix(in oklab, " + TIER_COLOR[t.tier] + " 16%, transparent)"
                      : "transparent",
                  }}
                >
                  <span
                    className="mt-1 size-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: TIER_COLOR[t.tier] }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold tracking-wide uppercase text-foreground">
                        {t.label}
                      </span>
                      <span className="text-xs">{t.dot}</span>
                    </div>
                    <span className="block text-xs font-medium text-foreground/90 mt-0.5">
                      {t.title}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      {t.examples}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3 — Safe-Distance Hold Button */}
        <section className="panel p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="label-caps">Step 3 · Safe-Distance Safety Interlock</p>
            <span className="text-[11px] font-mono text-muted-foreground">
              {held ? "UNLOCKED" : `${remainingSeconds.toFixed(1)}s hold required`}
            </span>
          </div>

          <button
            type="button"
            disabled={!ready}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            className="relative mt-2 w-full overflow-hidden rounded-lg border border-border py-4 select-none disabled:opacity-40 transition-colors"
            style={{
              backgroundColor: held
                ? "color-mix(in oklab, var(--tier-low) 24%, transparent)"
                : "var(--muted)",
            }}
          >
            {/* Progress Fill Bar */}
            <span
              className="absolute inset-y-0 left-0 bg-primary/30 transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
            <span className="relative flex items-center justify-center gap-2 font-display text-sm tracking-widest uppercase font-semibold">
              {held ? (
                <>
                  <CheckCircle className="size-5 text-emerald-400" />
                  Confirmed: 5m+ Safe Distance Verified
                </>
              ) : (
                <>
                  <ShieldAlert className="size-5 text-amber-400" />
                  Hold 3s to Confirm 5m Safe Distance
                </>
              )}
            </span>
          </button>
          <p className="text-[11px] text-muted-foreground">
            Mandatory safety gate: Never touch or walk near downed lines. Voltage can ground through wet earth within 5 meters.
          </p>
        </section>

        {/* Submission Action */}
        <button
          onClick={submit}
          disabled={!held || submitting}
          className="w-full rounded-lg bg-primary py-3.5 font-display text-base font-bold tracking-widest text-primary-foreground uppercase shadow-md disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {submitting ? "Transmitting Report…" : `Submit Hazard Report · +${XP_REPORT} XP`}
        </button>

        {!user && (
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/auth" className="underline font-semibold text-primary">
              Sign in or create an account
            </Link>{" "}
            to credit your civic XP and earn electric bill discount vouchers.
          </p>
        )}
      </div>
    </AppShell>
  );
}
