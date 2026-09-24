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
};

type Props = {
  reports: MapReport[];
  center?: [number, number];
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [12.8797, 121.774]; // Philippines

export default function HazardMap({ reports, center, onSelect, selectedId, className }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const didFit = useRef(false);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: true }).setView(
      center ?? DEFAULT_CENTER,
      center ? 15 : 6,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (center && mapRef.current) mapRef.current.setView(center, 16);
  }, [center]);

  useEffect(() => {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    for (const r of reports) {
      const size = selectedId === r.id ? 24 : 18;
      const faded = r.status === "resolved" ? 0.45 : 1;
      const icon = L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div class="kable-pin" style="width:${size}px;height:${size}px;background:${TIER_COLOR[r.hazard_tier]};opacity:${faded}"></div>`,
      });
      const marker = L.marker([r.lat, r.lng], { icon }).addTo(layer);
      marker.on("click", () => onSelect?.(r.id));
    }

    if (!center && !didFit.current && reports.length > 0) {
      didFit.current = true;
      map.fitBounds(L.latLngBounds(reports.map((r) => [r.lat, r.lng] as [number, number])).pad(0.3), {
        maxZoom: 15,
      });
    }
  }, [reports, selectedId, onSelect, center]);

  return <div ref={elRef} className={className} />;
}
