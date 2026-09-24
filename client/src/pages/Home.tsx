import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  ChevronRight,
  CircleHelp,
  CloudRain,
  Crosshair,
  Gauge,
  Layers3,
  LocateFixed,
  MapPinned,
  Menu,
  Navigation,
  Radio,
  Route,
  Settings2,
  ShieldCheck,
  Siren,
  Sparkles,
  TrafficCone,
  UsersRound,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PredictionWindow = 30 | 60;
type TrafficLevel = "HIGH" | "MEDIUM" | "LOW";

type LocationProfile = {
  id: string;
  name: string;
  road: string;
  city: string;
  lat: number;
  lng: number;
  traffic: TrafficLevel;
  speed: number;
  occupancy: number;
  weather: string;
  weatherDetail: string;
  event: string;
  eventDetail: string;
  forecast: number[];
  peak: string;
  arrival: string;
  officers: number;
  recommendation: string;
  route: string;
  signal: string;
  reason: string;
};

type ScenarioPreset = {
  id: string;
  label: string;
  detail: string;
  occupancyDelta: number;
  speedDelta: number;
  forecastDelta: number;
};

const SCENARIO_PRESETS: ScenarioPreset[] = [
  { id: "baseline", label: "Current network", detail: "Observed conditions", occupancyDelta: 0, speedDelta: 0, forecastDelta: 0 },
  { id: "event-surge", label: "Event surge", detail: "Crowd release +12%", occupancyDelta: 12, speedDelta: -5, forecastDelta: 10 },
  { id: "rain-friction", label: "Rain friction", detail: "Wet-road slowdown", occupancyDelta: 8, speedDelta: -7, forecastDelta: 8 },
  { id: "incident-reroute", label: "Incident reroute", detail: "Lane loss + detour", occupancyDelta: 18, speedDelta: -10, forecastDelta: 15 },
];

const LOCATION_PROFILES: LocationProfile[] = [
  {
    id: "gandhipuram",
    name: "Gandhipuram Junction",
    road: "Avinashi Road",
    city: "Coimbatore",
    lat: 11.0183,
    lng: 76.9725,
    traffic: "HIGH",
    speed: 18,
    occupancy: 86,
    weather: "Clear",
    weatherDetail: "Visibility 9 km",
    event: "Market closing",
    eventDetail: "Peak footfall in 35 min",
    forecast: [72, 78, 84, 89, 93],
    peak: "5:45 PM",
    arrival: "5:00 PM",
    officers: 1,
    recommendation: "Pre-position 1 officer",
    route: "Avinashi Rd → 100 Feet Rd",
    signal: "Extend green by 18 sec",
    reason: "Evening volume is building faster than the corridor can clear.",
  },
  {
    id: "ukkadam",
    name: "Ukkadam Junction",
    road: "Palakkad Main Road",
    city: "Coimbatore",
    lat: 10.9904,
    lng: 76.9568,
    traffic: "MEDIUM",
    speed: 26,
    occupancy: 64,
    weather: "Light cloud",
    weatherDetail: "Visibility 8 km",
    event: "Bus bay active",
    eventDetail: "4 arrivals in 30 min",
    forecast: [54, 58, 62, 68, 73],
    peak: "6:05 PM",
    arrival: "5:25 PM",
    officers: 1,
    recommendation: "Hold 1 mobile unit",
    route: "Palakkad Rd → Sungam",
    signal: "Balance side-road release",
    reason: "Bus arrivals are adding short, sharp queues on the southbound approach.",
  },
  {
    id: "singanallur",
    name: "Singanallur Flyover",
    road: "Trichy Road",
    city: "Coimbatore",
    lat: 11.0008,
    lng: 77.0344,
    traffic: "HIGH",
    speed: 21,
    occupancy: 79,
    weather: "Clear",
    weatherDetail: "Visibility 10 km",
    event: "No active event",
    eventDetail: "Normal corridor activity",
    forecast: [66, 71, 77, 82, 87],
    peak: "5:30 PM",
    arrival: "4:55 PM",
    officers: 2,
    recommendation: "Deploy 2 officers",
    route: "Trichy Rd → Sungam Bypass",
    signal: "Meter flyover entry",
    reason: "The flyover merge is nearing its practical occupancy threshold.",
  },
  {
    id: "rs-puram",
    name: "R.S. Puram Road Segment",
    road: "D.B. Road",
    city: "Coimbatore",
    lat: 11.0111,
    lng: 76.9551,
    traffic: "LOW",
    speed: 34,
    occupancy: 42,
    weather: "Clear",
    weatherDetail: "Visibility 10 km",
    event: "School dispersal",
    eventDetail: "Expected in 55 min",
    forecast: [39, 44, 48, 55, 61],
    peak: "6:20 PM",
    arrival: "5:45 PM",
    officers: 0,
    recommendation: "Monitor remotely",
    route: "D.B. Rd → Cowley Brown Rd",
    signal: "No change required",
    reason: "Current throughput is healthy; a watch is sufficient before school dispersal.",
  },
];

const INITIAL_PROFILE = LOCATION_PROFILES[0];

function distanceBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  return Math.sqrt(Math.pow(aLat - bLat, 2) + Math.pow(aLng - bLng, 2));
}

function profileForPoint(lat: number, lng: number): LocationProfile {
  const nearest = LOCATION_PROFILES.reduce((closest, profile) => {
    const currentDistance = distanceBetween(lat, lng, profile.lat, profile.lng);
    const closestDistance = distanceBetween(lat, lng, closest.lat, closest.lng);
    return currentDistance < closestDistance ? profile : closest;
  }, INITIAL_PROFILE);

  const nearby = distanceBetween(lat, lng, nearest.lat, nearest.lng) < 0.014;
  if (nearby) return { ...nearest, lat, lng };

  const intensity = Math.round(52 + Math.abs(Math.sin(lat * 7 + lng * 11)) * 34);
  return {
    ...nearest,
    id: `segment-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    name: "Selected road segment",
    road: "Nearest mapped road",
    lat,
    lng,
    traffic: intensity > 72 ? "HIGH" : intensity > 57 ? "MEDIUM" : "LOW",
    speed: Math.max(16, Math.round(42 - intensity * 0.28)),
    occupancy: intensity,
    forecast: [Math.max(34, intensity - 12), Math.min(96, intensity - 7), Math.min(98, intensity), Math.min(99, intensity + 7), Math.min(99, intensity + 12)],
    peak: "5:55 PM",
    arrival: "5:15 PM",
    officers: intensity > 78 ? 2 : intensity > 58 ? 1 : 0,
    recommendation: intensity > 78 ? "Deploy 2 officers" : intensity > 58 ? "Pre-position 1 officer" : "Monitor remotely",
    reason: "The selected segment is being evaluated against nearby corridor patterns.",
  };
}

function formatCoordinate(value: number) {
  return value.toFixed(4);
}

function trafficColor(level: TrafficLevel) {
  if (level === "HIGH") return "text-[#f46f62]";
  if (level === "MEDIUM") return "text-[#e7b85e]";
  return "text-[#69d4a0]";
}

function trafficBg(level: TrafficLevel) {
  if (level === "HIGH") return "bg-[#f46f62]/10 border-[#f46f62]/20";
  if (level === "MEDIUM") return "bg-[#e7b85e]/10 border-[#e7b85e]/20";
  return "bg-[#69d4a0]/10 border-[#69d4a0]/20";
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [selected, setSelected] = useState<LocationProfile>(INITIAL_PROFILE);
  const [predictionWindow, setPredictionWindow] = useState<PredictionWindow>(30);
  const [mapReady, setMapReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTool, setActiveTool] = useState("SELECT AREA");
  const [trafficLayerOn, setTrafficLayerOn] = useState(true);
  const [eventsLayerOn, setEventsLayerOn] = useState(true);
  const [activeScenario, setActiveScenario] = useState("baseline");
  const liveContextQuery = trpc.intelligence.context.useQuery({ lat: selected.lat, lng: selected.lng }, { staleTime: 60_000 });
  const routePlanMutation = trpc.routes.plan.useMutation();
  const signalRequestMutation = trpc.signals.request.useMutation();
  const allocationMutation = trpc.allocations.create.useMutation();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const radiusRef = useRef<google.maps.Circle | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

  const liveProviderReady = Boolean(liveContextQuery.data?.providerStatus.maps || liveContextQuery.data?.providerStatus.weather);

  useEffect(() => {
    const data = liveContextQuery.data;
    if (!data || (data.point.lat !== selected.lat && data.point.lng !== selected.lng)) return;
    setSelected((current) => ({
      ...current,
      road: data.geocode?.road || current.road,
      city: data.geocode?.city || current.city,
      weather: data.weather?.label || current.weather,
      weatherDetail: data.weather ? `${data.weather.temperatureC ?? "—"}°C · ${data.weather.windSpeedKph ?? "—"} km/h wind` : current.weatherDetail,
      event: data.events.events[0]?.title || data.places[0]?.title || current.event,
      eventDetail: data.events.events[0]?.startsAt ? `Starts ${new Date(data.events.events[0].startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : current.eventDetail,
    }));
  }, [liveContextQuery.data, selected.lat, selected.lng]);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);

    if (window.google?.maps?.TrafficLayer) {
      const trafficLayer = new google.maps.TrafficLayer();
      trafficLayer.setMap(map);
      trafficLayerRef.current = trafficLayer;
    }

    map.addListener("click", (event: google.maps.MapMouseEvent) => {
      if (!event.latLng || activeTool !== "SELECT AREA") return;
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      const next = profileForPoint(lat, lng);
      setSelected(next);
      setPredictionWindow(30);
      toast.success("Area selected", {
        description: `${next.name} · traffic intelligence refreshed`,
      });

      if (window.google?.maps?.Geocoder) {
        new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            const roadComponent = results[0].address_components?.find((component) =>
              component.types.includes("route"),
            );
            const areaComponent = results[0].address_components?.find((component) =>
              component.types.includes("sublocality") || component.types.includes("neighborhood"),
            );
            if (roadComponent || areaComponent) {
              setSelected((current) => ({
                ...current,
                road: roadComponent?.long_name || current.road,
                city: areaComponent?.long_name || current.city,
              }));
            }
          }
        });
      }
    });
  }, [activeTool]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    markerRef.current?.setMap(null);
    radiusRef.current?.setMap(null);

    markerRef.current = new google.maps.Marker({
      map: mapRef.current,
      position: { lat: selected.lat, lng: selected.lng },
      title: selected.name,
      label: { text: "", className: "traffic-marker" },
    });

    radiusRef.current = new google.maps.Circle({
      map: mapRef.current,
      center: { lat: selected.lat, lng: selected.lng },
      radius: predictionWindow === 60 ? 1000 : 500,
      fillColor: "#ef765f",
      fillOpacity: 0.08,
      strokeColor: "#ef765f",
      strokeOpacity: 0.55,
      strokeWeight: 1,
      clickable: false,
    });
  }, [selected, predictionWindow, mapReady]);

  useEffect(() => {
    trafficLayerRef.current?.setMap(trafficLayerOn ? mapRef.current : null);
  }, [trafficLayerOn, mapReady]);

  const forecastData = useMemo(
    () => ["Now", "+15", "+30", "+45", "+60"].map((label, index) => ({ label, value: selected.forecast[index] })),
    [selected.forecast],
  );

  const congestionFactors = useMemo(() => [
    { label: "Vehicle volume", value: selected.occupancy > 75 ? 32 : 24, color: "#ef765f" },
    { label: "Low speed", value: selected.speed < 24 ? 24 : 16, color: "#e7b85e" },
    { label: "Occupancy", value: Math.round(selected.occupancy * 0.22), color: "#c98d6a" },
    { label: "Weather", value: selected.weather === "Clear" ? 8 : 12, color: "#7eb4bf" },
    { label: "Events", value: selected.event === "No active event" ? 4 : 8, color: "#a8a3d1" },
  ], [selected]);

  const forecastAtWindow = selected.forecast[predictionWindow === 30 ? 2 : 4];
  const optimizationScorecard = useMemo(() => {
    const intervention = selected.traffic === "HIGH" ? 18 : selected.traffic === "MEDIUM" ? 14 : 10;
    const projectedOccupancy = Math.max(18, forecastAtWindow - intervention);
    return {
      reduction: intervention,
      projectedOccupancy,
      etaGain: selected.traffic === "HIGH" ? 9 : selected.traffic === "MEDIUM" ? 6 : 3,
      officerEfficiency: selected.officers > 0 ? 22 : 14,
      signalGain: selected.traffic === "HIGH" ? 18 : selected.traffic === "MEDIUM" ? 12 : 0,
    };
  }, [forecastAtWindow, selected.officers, selected.traffic]);

  function applyScenario(preset: ScenarioPreset) {
    setActiveScenario(preset.id);
    if (preset.id === "baseline") {
      setSelected((current) => ({ ...current, ...profileForPoint(current.lat, current.lng) }));
    } else {
      setSelected((current) => ({
        ...current,
        traffic: current.occupancy + preset.occupancyDelta > 72 ? "HIGH" : current.occupancy + preset.occupancyDelta > 57 ? "MEDIUM" : "LOW",
        speed: Math.max(10, current.speed + preset.speedDelta),
        occupancy: Math.min(98, current.occupancy + preset.occupancyDelta),
        forecast: current.forecast.map((value) => Math.min(99, value + preset.forecastDelta)),
        reason: `${preset.label} simulation active: ${preset.detail.toLowerCase()} is applied to the selected corridor.`,
      }));
    }
    toast.success(`${preset.label} loaded`, { description: `${preset.detail} · compare the optimized response below.` });
  }

  function handleAnalyze() {
    setAnalyzing(true);
    window.setTimeout(() => {
      setAnalyzing(false);
      toast.success(`${predictionWindow}-minute prediction ready`, {
        description: `${selected.name} · ${forecastAtWindow}% predicted occupancy`,
      });
    }, 650);
  }

  function clearSelection() {
    setSelected(INITIAL_PROFILE);
    setPredictionWindow(30);
    toast("Selection reset", { description: "Showing the default Gandhipuram monitoring point." });
  }

  return (
    <div className="min-h-screen bg-[#0b0e13] text-[#f4f0e8]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[82px] shrink-0 flex-col items-center border-r border-white/8 bg-[#10141b] py-5 lg:flex">
          <div className="mb-11 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ef765f] text-[13px] font-black tracking-[-0.08em] text-[#201512] shadow-[0_8px_28px_rgba(239,118,95,0.28)]" aria-label="ZeroJam logo">
            ZJ
          </div>
          <nav className="flex flex-col items-center gap-3" aria-label="Primary navigation">
            <RailButton icon={<MapPinned size={20} />} label="Live map" active />
            <RailButton icon={<Activity size={20} />} label="Intelligence" />
            <RailButton icon={<Route size={20} />} label="Routes" />
            <RailButton icon={<Radio size={20} />} label="Signals" />
          </nav>
          <div className="mt-auto flex flex-col items-center gap-3">
            <RailButton icon={<CircleHelp size={19} />} label="Help" />
            <RailButton icon={<Settings2 size={19} />} label="Settings" />
            <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-bold text-[#b3b4b8]">RK</div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/8 bg-[#0b0e13]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-9">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#c9c6bf] lg:hidden" aria-label="Open navigation">
                  <Menu size={18} />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8d929c]">
                    <span className="hidden sm:inline">Operations centre</span>
                    <ChevronRight size={12} className="hidden sm:inline" />
                    <span className="text-[#ef765f]">Live monitoring</span>
                  </div>
                  <h1 className="truncate font-display text-[19px] font-semibold tracking-[-0.04em] text-[#f5f0e7] sm:text-[22px]">ZeroJam</h1>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full border border-[#69d4a0]/20 bg-[#69d4a0]/8 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8fe2b6] sm:flex">
                  <span className="status-dot bg-[#69d4a0]" /> Network nominal
                </div>
                <div className="flex items-center gap-2 border-l border-white/10 pl-3 text-right">
                  <div className="hidden sm:block">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7e848d]">Thursday, 24 Sep 2026</div>
                    <div className="mt-0.5 text-[12px] text-[#c6c3bc]">Shift A · 04:52 PM IST</div>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7b85e] text-[11px] font-bold text-[#292016]">RK</div>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1580px] space-y-5 px-4 py-5 sm:px-6 lg:px-9 lg:py-7">
            <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef765f]"><span className="status-dot bg-[#ef765f]" /> Simulation + optimization</div>
                <h2 className="max-w-2xl font-display text-[30px] font-semibold leading-[1.02] tracking-[-0.055em] text-[#f6f1e7] sm:text-[39px]">Simulate the road. <span className="text-[#9ca2ac]">Optimize the flow.</span></h2>
                <p className="mt-3 max-w-xl text-[13px] leading-6 text-[#9ca1ab]">Select any point on the live map to simulate traffic conditions, compare interventions, and optimize officer action in one operational view.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] ${liveProviderReady ? "border-[#69d4a0]/20 bg-[#69d4a0]/8 text-[#8fe2b6]" : "border-white/10 bg-white/5 text-[#b8bbc1]"}`}><span className={`status-dot ${liveProviderReady ? "bg-[#69d4a0]" : "bg-[#e7b85e]"}`} /> {liveProviderReady ? "Live integrations" : "Demo analytics"}</div>
                <button onClick={clearSelection} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#c9c6bf] transition hover:border-white/20 hover:bg-white/10 active:scale-[0.98]"><LocateFixed size={14} /> Reset point</button>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.38fr)_minmax(360px,0.62fr)]">
              <div className="relative min-h-[515px] overflow-hidden rounded-[26px] border border-white/10 bg-[#d9d4c8] shadow-[0_28px_80px_rgba(0,0,0,0.24)] sm:min-h-[570px]">
                <div className="absolute inset-0 map-fallback" aria-hidden="true">
                  <div className="map-road road-one" />
                  <div className="map-road road-two" />
                  <div className="map-road road-three" />
                  <div className="map-block block-one" />
                  <div className="map-block block-two" />
                  <div className="map-block block-three" />
                  <div className="map-block block-four" />
                </div>
                <MapView className="map-viewport relative z-[1]" initialCenter={{ lat: 11.007, lng: 76.985 }} initialZoom={13} onMapReady={handleMapReady} />
                <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,rgba(7,12,18,0.52),transparent_23%,transparent_68%,rgba(7,12,18,0.48))]" />
                <div className="pointer-events-none absolute left-4 top-4 z-[3] flex flex-wrap gap-2 sm:left-5 sm:top-5">
                  <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/15 bg-[#141b20]/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white shadow-lg backdrop-blur-md"><span className={`status-dot ${mapReady ? "bg-[#69d4a0]" : "bg-[#e7b85e]"}`} /> {mapReady ? "Live map" : "Map preview"}</div>
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.15em] ${liveProviderReady ? "border-[#69d4a0]/30 bg-[#163329]/90 text-[#8fe2b6]" : "border-[#e7b85e]/30 bg-[#33291d]/90 text-[#f0c979]"}`}><span className={`status-dot ${liveProviderReady ? "bg-[#69d4a0]" : "bg-[#e7b85e]"}`} /> {liveProviderReady ? "Production context" : "Demo data"}</div>
                </div>
                <div className="pointer-events-none absolute right-4 top-4 z-[3] hidden items-center gap-1.5 rounded-xl border border-white/15 bg-[#141b20]/90 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md sm:flex"><Layers3 size={13} /> Traffic layer {trafficLayerOn ? "on" : "off"}</div>
                <div className="pointer-events-none absolute bottom-4 left-4 z-[3] max-w-[280px] sm:bottom-5 sm:left-5">
                  <div className="rounded-2xl border border-white/15 bg-[#131a1e]/90 p-3.5 shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f4eee3]"><Crosshair size={13} className="text-[#ef765f]" /> Click anywhere to select an area</div>
                    <div className="mt-1.5 text-[11px] leading-5 text-[#b6b9b7]">The selected point drives the forecast, route, and response plan.</div>
                  </div>
                </div>
                <div className="pointer-events-none absolute bottom-4 right-4 z-[3] hidden sm:block">
                  <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#131a1e]/90 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#d7d5cf] backdrop-blur-md"><span className="legend-dot bg-[#69d4a0]" /> Free <span className="legend-dot bg-[#e7b85e]" /> Slow <span className="legend-dot bg-[#ef765f]" /> Stop &amp; go</div>
                </div>
              </div>

              <aside className="flex flex-col rounded-[26px] border border-white/10 bg-[#151922] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.18)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef765f]"><MapPinned size={13} /> Selected area</div>
                    <h3 className="font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.05em] text-[#f5f0e7]">{selected.name}</h3>
                    <p className="mt-2 text-[12px] text-[#9299a2]">{selected.road} · {selected.city}</p>
                  </div>
                  <div className={`rounded-xl border px-2.5 py-2 text-center ${trafficBg(selected.traffic)}`}>
                    <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#9ba0a7]">Traffic</div>
                    <div className={`mt-0.5 text-[12px] font-black tracking-[0.08em] ${trafficColor(selected.traffic)}`}>{selected.traffic}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/8 py-4">
                  <Metric icon={<Gauge size={14} />} label="Speed" value={`${selected.speed}`} unit="km/h" />
                  <Metric icon={<CarFront size={14} />} label="Occupancy" value={`${selected.occupancy}`} unit="%" />
                  <Metric icon={<Navigation size={14} />} label="Point" value={formatCoordinate(selected.lat)} unit={formatCoordinate(selected.lng)} />
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8e949e]">Prediction horizon</span><span className="text-[10px] font-semibold text-[#ef765f]">{forecastAtWindow}% occupancy</span></div>
                  <div className="flex gap-2">
                    {([30, 60] as PredictionWindow[]).map((windowSize) => (
                      <button key={windowSize} onClick={() => setPredictionWindow(windowSize)} className={`flex-1 rounded-xl border py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition active:scale-[0.98] ${predictionWindow === windowSize ? "border-[#ef765f]/60 bg-[#ef765f] text-[#231512] shadow-[0_8px_24px_rgba(239,118,95,0.2)]" : "border-white/10 bg-white/5 text-[#adb1b7] hover:border-white/20 hover:bg-white/10"}`}>{windowSize} min</button>
                    ))}
                  </div>
                  <button onClick={handleAnalyze} className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#efe8dc] py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#1c1a18] transition hover:bg-white active:scale-[0.985]">{analyzing ? <><span className="loader-ring" /> Refreshing intelligence</> : <><Sparkles size={14} /> Predict traffic</>}</button>
                </div>

                <div className="mt-5 space-y-3 rounded-2xl border border-white/8 bg-[#10141a] p-4">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#858c96]">Point intelligence</span><span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#69d4a0]"><span className="status-dot bg-[#69d4a0]" /> Updated now</span></div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <DataLine icon={<CloudRain size={14} />} label="Weather" value={selected.weather} detail={selected.weatherDetail} />
                    <DataLine icon={<CalendarDays size={14} />} label="Nearby event" value={selected.event} detail={selected.eventDetail} />
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <div className="flex items-center justify-between border-t border-white/8 pt-4"><div><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#838992]">Map coordinates</div><div className="mt-1 text-[11px] font-medium text-[#d3d0c9]">{formatCoordinate(selected.lat)}, {formatCoordinate(selected.lng)}</div></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ef765f]/10 text-[#ef765f]"><MapPinned size={17} /></div></div>
                </div>
              </aside>
            </section>

            <div className="flex flex-wrap items-center gap-2 border-b border-white/8 pb-5">
                {[
                  { label: "SELECT AREA", icon: <Crosshair size={13} /> },
                  { label: "CLEAR", icon: <LocateFixed size={13} /> },
                  { label: "ANALYZE", icon: <Sparkles size={13} /> },
                  { label: "ROUTE", icon: <Route size={13} /> },
                  { label: "TRAFFIC LAYER", icon: <Layers3 size={13} /> },
                  { label: "EVENTS", icon: <CalendarDays size={13} /> },
                  { label: "SIGNAL", icon: <Radio size={13} /> },
              ].map((tool) => (
                <button key={tool.label} onClick={() => {
                  if (tool.label === "CLEAR") return clearSelection();
                  if (tool.label === "ANALYZE") return handleAnalyze();
                  if (tool.label === "TRAFFIC LAYER") { setTrafficLayerOn((value) => !value); return; }
                  if (tool.label === "EVENTS") { setEventsLayerOn((value) => !value); return; }
                  if (tool.label === "ROUTE") {
                    if (!isAuthenticated) { toast("Sign in to save route advisories"); startLogin(); return; }
                    routePlanMutation.mutate({ origin: "Coimbatore Traffic Control Centre", destination: selected.name }, { onSuccess: (result) => toast.success(result.persisted ? "Route advisory saved" : "Route advisory calculated", { description: `${result.route.summary} · ${result.route.durationInTrafficSeconds ?? result.route.durationSeconds ?? 0}s` }), onError: (error) => toast.error("Route advisory unavailable", { description: error.message }) });
                    return;
                  }
                  if (tool.label === "SIGNAL") {
                    if (!isAuthenticated) { toast("Sign in to request signal actions"); startLogin(); return; }
                    signalRequestMutation.mutate({ selectedArea: selected.name, controllerId: "coimbatore-signal-controller", action: selected.signal }, { onSuccess: (result) => toast(result.delivery.status === "notConfigured" ? "Signal control not configured" : "Signal action sent", { description: result.delivery.status === "notConfigured" ? "Add SIGNAL_CONTROL_BASE_URL and SIGNAL_CONTROL_API_KEY to enable live control." : selected.signal }), onError: (error) => toast.error("Signal action failed", { description: error.message }) });
                    return;
                  }
                  setActiveTool(tool.label);
                  toast(tool.label === "SELECT AREA" ? "Selection mode active" : `${tool.label.toLowerCase()} mode active`);
                }} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] transition active:scale-[0.98] ${activeTool === tool.label || (tool.label === "TRAFFIC LAYER" && trafficLayerOn) || (tool.label === "EVENTS" && eventsLayerOn) ? "border-[#ef765f]/40 bg-[#ef765f]/10 text-[#f6a18f]" : "border-white/10 bg-white/5 text-[#9ca2ab] hover:border-white/20 hover:bg-white/10"}`}>{tool.icon}{tool.label}</button>
              ))}
              <div className="ml-auto hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#6f7680] md:flex"><span className="status-dot bg-[#ef765f]" /> Selection mode: {activeTool === "SELECT AREA" ? "ready" : activeTool.toLowerCase()}</div>
            </div>

            <section className="rounded-[26px] border border-[#8ba8d9]/20 bg-[#111722] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.12)] sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8ba8d9]"><Gauge size={13} /> Scenario lab</div><h3 className="font-display text-[23px] font-semibold tracking-[-0.045em] text-[#f2eee6]">Simulate what happens next.</h3><p className="mt-1.5 text-[12px] text-[#8e959f]">Load a controlled scenario, then compare ZeroJam’s optimized response.</p></div>
                <div className="rounded-xl border border-[#8ba8d9]/20 bg-[#8ba8d9]/8 px-3 py-2 text-right"><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#899bb8]">Active scenario</div><div className="mt-0.5 text-[12px] font-bold text-[#c9d7ef]">{SCENARIO_PRESETS.find((preset) => preset.id === activeScenario)?.label}</div></div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {SCENARIO_PRESETS.map((preset) => <button key={preset.id} onClick={() => applyScenario(preset)} className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${activeScenario === preset.id ? "border-[#8ba8d9]/60 bg-[#8ba8d9]/15" : "border-white/8 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold text-[#d8deea]">{preset.label}</span>{activeScenario === preset.id && <span className="status-dot bg-[#69d4a0]" />}</div><div className="mt-1 text-[10px] text-[#7e8ba0]">{preset.detail}</div></button>)}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
              <div className="rounded-[26px] border border-white/10 bg-[#151922] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.14)] sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef765f]"><Activity size={13} /> Forecast intelligence</div><h3 className="font-display text-[24px] font-semibold tracking-[-0.045em] text-[#f2eee6]">{predictionWindow}-minute corridor outlook</h3><p className="mt-1.5 text-[12px] text-[#8e959f]">Predicted occupancy · {selected.name}</p></div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a8adb5]"><span className={`status-dot ${liveProviderReady ? "bg-[#69d4a0]" : "bg-[#e7b85e]"}`} /> {liveProviderReady ? "Provider context connected" : "Demo forecast · provider setup pending"}</div>
                </div>
                <div className="mt-5 h-[230px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef765f" stopOpacity={0.34} /><stop offset="100%" stopColor="#ef765f" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid vertical={false} stroke="#ffffff" strokeOpacity={0.08} strokeDasharray="3 4" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#7f8791", fontSize: 10, fontWeight: 700 }} dy={10} />
                      <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#68707a", fontSize: 10 }} tickFormatter={(value) => `${value}%`} />
                      <Tooltip cursor={{ stroke: "#ef765f", strokeOpacity: 0.25 }} content={<ForecastTooltip />} />
                      <Area type="monotone" dataKey="value" stroke="#ef765f" strokeWidth={3} fill="url(#forecastFill)" activeDot={{ r: 5, fill: "#f4e9dc", stroke: "#ef765f", strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 border-t border-white/8 pt-4 sm:grid-cols-5">
                  {forecastData.map((point, index) => <div key={point.label} className={index === (predictionWindow === 30 ? 2 : 4) ? "rounded-xl bg-[#ef765f]/10 p-2" : "p-2"}><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7e858f]">{point.label}</div><div className={`mt-1 font-display text-[19px] font-semibold ${index === (predictionWindow === 30 ? 2 : 4) ? "text-[#f49a87]" : "text-[#ddd9d0]"}`}>{point.value}%</div></div>)}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-[#151922] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.14)] sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ef765f]"><AlertTriangle size={13} /> Explainable forecast</div><h3 className="font-display text-[24px] font-semibold tracking-[-0.045em] text-[#f2eee6]">Why congestion?</h3></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ef765f]/10 text-[#ef765f]"><Zap size={17} /></div></div>
                <p className="mb-5 text-[12px] leading-5 text-[#979da6]">{selected.reason}</p>
                <div className="space-y-4">{congestionFactors.map((factor) => <div key={factor.label}><div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-medium text-[#c4c4bf]">{factor.label}</span><span className="font-bold text-[#e4e0d7]">{factor.value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/7"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, factor.value * 2.4)}%`, backgroundColor: factor.color }} /></div></div>)}</div>
                <div className="mt-6 flex items-center justify-between border-t border-white/8 pt-4"><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e858f]">Confidence</span><span className="flex items-center gap-1.5 text-[11px] font-bold text-[#69d4a0]"><ShieldCheck size={14} /> 87% · high</span></div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[26px] border border-[#e7b85e]/20 bg-[#191814] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.12)] sm:p-6">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#e7b85e]"><Siren size={13} /> Officer pre-allocation</div><h3 className="font-display text-[24px] font-semibold tracking-[-0.045em] text-[#f3e9d4]">Act before the peak.</h3><p className="mt-1.5 text-[12px] text-[#a9a190]">{selected.recommendation} for {selected.name}</p></div><div className="rounded-xl border border-[#e7b85e]/20 bg-[#e7b85e]/10 px-3 py-2 text-right"><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#a99b7a]">Predicted peak</div><div className="mt-0.5 font-display text-[17px] font-semibold text-[#f0c976]">{selected.peak}</div></div></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-3"><PlanItem icon={<UsersRound size={16} />} label="Deploy" value={`${selected.officers} officer${selected.officers === 1 ? "" : "s"}`} /><PlanItem icon={<CalendarDays size={16} />} label="Arrival" value={selected.arrival} /><PlanItem icon={<TrafficCone size={16} />} label="Status" value={selected.officers ? "SCHEDULED" : "MONITOR"} /></div>
                <button onClick={() => { if (!isAuthenticated) { toast("Sign in to persist officer allocations"); startLogin(); return; } allocationMutation.mutate({ officerId: 1, selectedArea: selected.name, road: selected.road, latitude: selected.lat, longitude: selected.lng, horizonMinutes: predictionWindow, predictedOccupancy: forecastAtWindow, arrivalAt: new Date(`${new Date().toISOString().slice(0, 10)}T${selected.arrival}:00`), notes: selected.recommendation }, { onSuccess: (result) => toast.success(result ? "Officer allocation scheduled" : "Allocation prepared", { description: result ? "Persisted to the operations database." : "Database connection is pending." }), onError: (error) => toast.error("Allocation failed", { description: error.message }) }); }} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#e7b85e]/25 bg-[#e7b85e]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#f0c976] transition hover:bg-[#e7b85e]/15 active:scale-[0.98]"><Siren size={13} /> Schedule persistent allocation</button>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-[#151922] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8ba8d9]"><Navigation size={13} /> Intervention advisory</div><h3 className="font-display text-[24px] font-semibold tracking-[-0.045em] text-[#f2eee6]">Where to act next</h3></div><ArrowUpRight size={18} className="text-[#69d4a0]" /></div><div className="space-y-2.5"><Advisory icon={<Route size={15} />} label="Preferred route" value={selected.route} /><Advisory icon={<Radio size={15} />} label="Signal advisory" value={selected.signal} /><Advisory icon={<CloudRain size={15} />} label="Conditions" value={`${selected.weather} · ${selected.event}`} /></div></div>
            </section>

            <section className="rounded-[26px] border border-[#69d4a0]/20 bg-[#111a18] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.12)] sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#69d4a0]"><Sparkles size={13} /> Optimization scorecard</div><h3 className="font-display text-[24px] font-semibold tracking-[-0.045em] text-[#edf5ef]">Make the next move measurable.</h3><p className="mt-1.5 text-[12px] text-[#9bb0a4]">Projected effect of the recommended ZeroJam response for {selected.name}.</p></div><div className="rounded-xl border border-[#69d4a0]/20 bg-[#69d4a0]/8 px-3 py-2 text-right"><div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#8eb59e]">Optimization status</div><div className="mt-0.5 text-[12px] font-bold text-[#a8e2bc]">READY TO DEPLOY</div></div></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ScorecardMetric label="Congestion reduction" value={`-${optimizationScorecard.reduction}%`} detail={`${forecastAtWindow}% → ${optimizationScorecard.projectedOccupancy}% occupancy`} />
                <ScorecardMetric label="Estimated ETA gain" value={`${optimizationScorecard.etaGain} min`} detail="corridor travel time" />
                <ScorecardMetric label="Officer efficiency" value={`+${optimizationScorecard.officerEfficiency}%`} detail="coverage per unit" />
                <ScorecardMetric label="Signal improvement" value={optimizationScorecard.signalGain ? `+${optimizationScorecard.signalGain}s` : "Monitor"} detail={optimizationScorecard.signalGain ? "green-time recommendation" : "no timing change"} />
              </div>
            </section>

            <footer className="flex flex-col justify-between gap-3 border-t border-white/8 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#656c76] sm:flex-row sm:items-center"><span>ZeroJam · simulation + optimization</span><span className="flex items-center gap-2"><span className="status-dot bg-[#69d4a0]" /> Data labels are explicit · {liveProviderReady ? "Production providers connected" : "Demo fallback active"}</span></footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function RailButton({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return <button aria-label={label} className={`group relative flex h-11 w-11 items-center justify-center rounded-2xl transition ${active ? "bg-[#ef765f]/15 text-[#ef8b77]" : "text-[#68717c] hover:bg-white/6 hover:text-[#d7d4cd]"}`}>{icon}<span className="pointer-events-none absolute left-14 z-30 hidden whitespace-nowrap rounded-lg bg-[#20252e] px-2 py-1 text-[10px] font-semibold text-white shadow-xl group-hover:block">{label}</span></button>;
}

function Metric({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
  return <div className="min-w-0"><div className="flex items-center gap-1.5 text-[#8c939d]">{icon}<span className="truncate text-[9px] font-bold uppercase tracking-[0.13em]">{label}</span></div><div className="mt-2 truncate font-display text-[18px] font-semibold tracking-[-0.04em] text-[#ebe7df]">{value}<span className="ml-1 text-[10px] font-medium tracking-normal text-[#89909a]">{unit}</span></div></div>;
}

function DataLine({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="flex items-start gap-2.5"><div className="mt-0.5 text-[#8ba8d9]">{icon}</div><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#737b86]">{label}</div><div className="mt-1 truncate text-[12px] font-semibold text-[#dedbd3]">{value}</div><div className="mt-0.5 truncate text-[10px] text-[#7f8791]">{detail}</div></div></div>;
}

function PlanItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-[#e7b85e]/12 bg-[#e7b85e]/5 p-3"><div className="flex items-center gap-2 text-[#c5a55f]">{icon}<span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#a99d81]">{label}</span></div><div className="mt-2 text-[13px] font-semibold text-[#f0e1c5]">{value}</div></div>;
}

function ScorecardMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-[#69d4a0]/12 bg-[#69d4a0]/5 p-4"><div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8eb59e]">{label}</div><div className="mt-2 font-display text-[23px] font-semibold tracking-[-0.04em] text-[#a8e2bc]">{value}</div><div className="mt-1 text-[10px] text-[#799587]">{detail}</div></div>;
}

function Advisory({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8ba8d9]/10 text-[#8ba8d9]">{icon}</div><div className="min-w-0"><div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#747c87]">{label}</div><div className="mt-1 truncate text-[12px] font-semibold text-[#d7d5cf]">{value}</div></div><ArrowDownRight size={14} className="ml-auto shrink-0 text-[#5e6670]" /></div>;
}

function ForecastTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-white/10 bg-[#1b2029] px-3 py-2 shadow-xl"><div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8f97a1]">{label}</div><div className="mt-1 font-display text-[18px] font-semibold text-[#f39a86]">{payload[0].value}%</div></div>;
}

// Prevent the unused icon import from being tree-shaken inconsistently in older Vite preview builds.
void TrafficCone;
