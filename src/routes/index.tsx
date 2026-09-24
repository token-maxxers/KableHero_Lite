import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Crosshair, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photo";
import { HAZARD_TIERS, TIER_COLOR, XP_REPORT, type HazardTier } from "@/lib/kable";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KableHero Lite — Report an electric hazard" },
      {
        name: "description",
        content:
          "Tap once to pin a downed wire, leaning pole or dangling cable with photo proof and GPS, so cooperative crews reach real hazards faster.",
      },
      { property: "og:title", content: "KableHero Lite — Report an electric hazard" },
      {
        property: "og:description",
        content: "Crowdsourced electric hazard reporting for Philippine communities and cooperatives.",
      },
    ],
  }),
  component: ReporterPage,
});

const HOLD_MS = 3000;

function ReporterPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tier, setTier] = useState<HazardTier | null>(null);
  const [held, setHeld] = useState(false);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("This phone can't share its location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: Math.round(pos.coords.accuracy),
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Location blocked. Allow location access and try again.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
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
      const pct = Math.min(100, ((Date.now() - start) / HOLD_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        if (timer.current) window.clearInterval(timer.current);
        setHeld(true);
      }
    }, 50);
  };

  const endHold = () => {
    if (timer.current) window.clearInterval(timer.current);
    if (!held) setProgress(0);
  };

  const submit = async () => {
    if (!user) {
      toast.error("Sign in first so your XP is credited.");
      void navigate({ to: "/auth" });
      return;
    }
    if (!coords || !tier || !held) return;
    setSubmitting(true);
    try {
      let photoPath: string | null = null;
      if (photo) {
        const ext = photo.name.split(".").pop() ?? "jpg";
        photoPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(photoPath, photo, { contentType: photo.type || "image/jpeg" });
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("reports").insert({
        user_id: user.id,
        lat: coords.lat,
        lng: coords.lng,
        hazard_tier: tier,
        photo_url: photoPath,
      });
      if (error) throw error;
      await refreshProfile();
      toast.success(`Hazard reported. +${XP_REPORT} XP`);
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
      <div className="space-y-5 px-4 py-5">
        <section>
          <h1 className="text-3xl leading-tight font-semibold uppercase">
            Report a hazard
            <span className="block text-primary">in three taps</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stay far from the wire. Photo and GPS go straight to the cooperative's triage map.
          </p>
        </section>

        {/* Step 1 — capture */}
        <section className="panel p-4">
          <p className="label-caps">Step 1 · Capture</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border px-3 py-5 text-center">
              {preview ? (
                <img src={preview} alt="Hazard preview" className="h-20 w-full rounded object-cover" />
              ) : (
                <Camera className="size-7 text-primary" />
              )}
              <span className="font-display text-sm tracking-wider uppercase">
                {photo ? "Retake photo" : "Photo proof"}
              </span>
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
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-5 text-center"
            >
              {locating ? (
                <Loader2 className="size-7 animate-spin text-accent" />
              ) : (
                <Crosshair className="size-7 text-accent" />
              )}
              <span className="font-display text-sm tracking-wider uppercase">
                {coords ? "Location locked" : "Get location"}
              </span>
              {coords && (
                <span className="text-xs text-muted-foreground">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · ±{coords.acc}m
                </span>
              )}
            </button>
          </div>
        </section>

        {/* Step 2 — tier */}
        <section className="panel p-4">
          <p className="label-caps">Step 2 · How dangerous is it?</p>
          <div className="mt-3 space-y-2">
            {HAZARD_TIERS.map((t) => {
              const active = tier === t.tier;
              return (
                <button
                  key={t.tier}
                  onClick={() => {
                    setTier(t.tier);
                    setHeld(false);
                    setProgress(0);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
                  style={{
                    borderColor: active ? TIER_COLOR[t.tier] : "var(--border)",
                    backgroundColor: active ? "color-mix(in oklab, " + TIER_COLOR[t.tier] + " 18%, transparent)" : "transparent",
                  }}
                >
                  <span
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: TIER_COLOR[t.tier] }}
                  />
                  <span>
                    <span className="block font-display text-base tracking-wide uppercase">
                      {t.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{t.examples}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 3 — safe distance hold */}
        <section className="panel p-4">
          <p className="label-caps">Step 3 · Safe-distance hold</p>
          <button
            disabled={!ready}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            className="relative mt-3 w-full overflow-hidden rounded-lg border border-border py-5 select-none disabled:opacity-50"
            style={{ backgroundColor: held ? "color-mix(in oklab, var(--tier-low) 22%, transparent)" : "var(--muted)" }}
          >
            <span
              className="absolute inset-y-0 left-0 bg-primary/30 transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
            <span className="relative flex items-center justify-center gap-2 font-display text-sm tracking-widest uppercase">
              <ShieldAlert className="size-5" />
              {held ? "Safe distance confirmed" : "Hold: I am 5+ meters away"}
            </span>
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Hold for 3 seconds. Never touch or approach a fallen line — it can be live even when
            silent.
          </p>
        </section>

        <button
          onClick={submit}
          disabled={!held || submitting}
          className="w-full rounded-lg bg-primary py-4 font-display text-lg tracking-widest text-primary-foreground uppercase disabled:opacity-40"
        >
          {submitting ? "Sending…" : `Submit report · +${XP_REPORT} XP`}
        </button>

        {!user && (
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/auth" className="underline">
              Sign in
            </Link>{" "}
            to submit and collect XP.
          </p>
        )}
      </div>
    </AppShell>
  );
}
