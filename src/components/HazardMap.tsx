import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TIER_COLOR, type HazardTier, type ReportStatus } from "@/lib/kable";

export type MapReport = {
  id: string;
  lat: number;
  lng: number;
  hazard_tier: HazardTier;
  status: ReportStatus;
  verification_count: number;
  landmark?: string | null;
  pole_number?: string | null;
  clusterCount?: number;
};

type Props = {
  reports: MapReport[];
  center?: [number, number];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  className?: string;
  autoFit?: boolean;
};

const DEFAULT_CENTER: [number, number] = [8.3671, 124.8645]; // Bukidnon / BUSECO franchise area

export default function HazardMap({
  reports,
  center,
  onSelect,
  selectedId,
  className,
  autoFit = true,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const didFit = useRef(false);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const initialCenter = center || (reports.length > 0 ? [reports[0]!.lat, reports[0]!.lng] : DEFAULT_CENTER);
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: true }).setView(
      initialCenter,
      13
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(elRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (center && mapRef.current) {
      mapRef.current.setView(center, 16, { animate: true });
    }
  }, [center]);

  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    for (const r of reports) {
      const isSelected = selectedId === r.id;
      const size = isSelected ? 26 : 20;
      const isCritical = r.hazard_tier === "critical" && r.status !== "resolved";
      const isResolved = r.status === "resolved";
      const opacity = isResolved ? 0.45 : 1;
      const pulseClass = isCritical ? "pin-pulse-critical" : "";
      const clusterBadge =
        r.clusterCount && r.clusterCount > 1
          ? `<span style="position:absolute;top:-6px;right:-6px;background:#1e293b;color:#f8fafc;font-size:10px;font-weight:700;border-radius:9999px;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1px solid #94a3b8;">${r.clusterCount}</span>`
          : "";

      const icon = L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `
          <div style="position:relative;width:${size}px;height:${size}px;">
            <div class="kable-pin ${pulseClass}" style="width:${size}px;height:${size}px;background:${TIER_COLOR[r.hazard_tier]};opacity:${opacity};${isSelected ? "border:3px solid #ffffff;transform:scale(1.15);" : ""}">
              ${isResolved ? '<span style="color:#ffffff;font-size:10px;font-weight:bold;">✓</span>' : ""}
            </div>
            ${clusterBadge}
          </div>
        `,
      });

      const marker = L.marker([r.lat, r.lng], { icon }).addTo(layer);

      if (r.landmark || r.pole_number) {
        const titleText = `${r.hazard_tier.toUpperCase()}: ${r.landmark || r.pole_number}`;
        marker.bindTooltip(titleText, { direction: "top", offset: [0, -10] });
      }

      marker.on("click", () => {
        onSelect?.(r.id);
        map.panTo([r.lat, r.lng], { animate: true });
      });
    }

    if (autoFit && !center && !didFit.current && reports.length > 0) {
      didFit.current = true;
      const bounds = L.latLngBounds(reports.map((r) => [r.lat, r.lng] as [number, number])).pad(0.2);
      map.fitBounds(bounds, { maxZoom: 14 });
    }
  }, [reports, selectedId, onSelect, center, autoFit]);

  return <div ref={elRef} className={className} />;
}
