import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Award,
  Check,
  Crosshair,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  MapPin,
  Navigation,
  X,
} from 'lucide-react';
import { AppErrorBoundary } from './AppErrorBoundary';
import { DISTRICTS, formatLocationLabel } from '../data/bdLocations';
import { BLOOD_GROUPS } from '../lib/validation';
import {
  BANGLADESH_CENTER,
  BANGLADESH_MAP_BOUNDS,
  formatDistanceKm,
  getAreaCoords,
  getObfuscatedDonorCoords,
  haversineDistance,
  type GeoCoordinate,
} from '../lib/geoUtils';
import { getDonorTier } from '../lib/donorBadge';
import type { DonorProfile } from '../types';

interface DonorMapComponentProps {
  donors: DonorProfile[];
  userLocation: GeoCoordinate | null;
  userAddress: string | null;
  locationMode: 'gps' | 'manual' | null;
  locatingUser: boolean;
  resolvingAddress: boolean;
  locationError: string | null;
  selectedDistrictId?: string;
  focusCoords?: GeoCoordinate | null;
  onRequestLocation: () => void;
  onSetManualLocation: (coords: GeoCoordinate, customLabel?: string) => void;
  onDismissLocationError?: () => void;
  onSelectDonor: (donor: DonorProfile) => void;
  lang: 'bn' | 'en';
}

type TileStyleId = 'street' | 'osm' | 'satellite';

const TILE_PROVIDERS: Record<
  TileStyleId,
  {
    url: string;
    attribution: string;
    subdomains?: string | string[];
    maxZoom: number;
    labelBn: string;
    labelEn: string;
  }
> = {
  street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; OpenStreetMap contributors',
    maxZoom: 18,
    labelBn: 'রাস্তার ম্যাপ',
    labelEn: 'Street Map',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, Tiles style by HOT',
    subdomains: 'abc',
    maxZoom: 19,
    labelBn: 'OSM বিস্তারিত',
    labelEn: 'OSM Detailed',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
    labelBn: 'স্যাটেলাইট',
    labelEn: 'Satellite',
  },
};

const VALID_BLOOD_GROUP_SET = new Set<string>(BLOOD_GROUPS);

function sanitizeBloodGroup(group?: string): string {
  if (group && VALID_BLOOD_GROUP_SET.has(group)) {
    return group;
  }
  return 'O+';
}

function createDonorDivIcon(
  bloodGroup: string,
  isSelected: boolean,
  isNearest: boolean
): L.DivIcon {
  const safeGroup = sanitizeBloodGroup(bloodGroup);
  const bg = isSelected ? '#99061e' : '#C80828';
  const border = isSelected
    ? '#ffffff'
    : isNearest
    ? '#6ee7b7'
    : '#ffffff';
  const ring = isSelected
    ? 'box-shadow: 0 0 0 4px rgba(200, 8, 40, 0.35), 0 6px 14px rgba(0,0,0,0.28); transform: scale(1.16);'
    : isNearest
    ? 'box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.45), 0 4px 10px rgba(0,0,0,0.22);'
    : 'box-shadow: 0 4px 10px rgba(0,0,0,0.22);';

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;">
      <div style="width:36px;height:36px;border-radius:14px;background:${bg};color:#ffffff;border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;font-family:monospace;${ring}">
        ${safeGroup}
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${bg};margin-top:-1px;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [36, 42],
    iconAnchor: [18, 42],
  });
}

function createUserDivIcon(): L.DivIcon {
  const html = `
    <div style="width:36px;height:36px;border-radius:9999px;background:rgba(37,99,235,0.22);display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="width:22px;height:22px;border-radius:9999px;background:#2563eb;border:2.5px solid #ffffff;box-shadow:0 4px 10px rgba(37,99,235,0.45);display:flex;align-items:center;justify-content:center;">
        <div style="width:7px;height:7px;border-radius:9999px;background:#ffffff;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export function DonorMapComponent({
  donors,
  userLocation,
  userAddress,
  locationMode,
  locatingUser,
  resolvingAddress,
  locationError,
  selectedDistrictId = '',
  focusCoords,
  onRequestLocation,
  onSetManualLocation,
  onDismissLocationError,
  onSelectDonor,
  lang,
}: DonorMapComponentProps) {
  const [selectedDonor, setSelectedDonor] = useState<DonorProfile | null>(null);
  const [showUserInfoCard, setShowUserInfoCard] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [recenterToken, setRecenterToken] = useState(0);
  const [pickedDistrictId, setPickedDistrictId] = useState(selectedDistrictId);
  const [tileStyle, setTileStyle] = useState<TileStyleId>('street');
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const donorLayerRef = useRef<L.LayerGroup | null>(null);

  const hasCenteredOnUserRef = useRef(false);
  const lastFocusedKeyRef = useRef<string>('');
  const tileErrorCountRef = useRef(0);

  const onSetManualLocationRef = useRef(onSetManualLocation);
  useEffect(() => {
    onSetManualLocationRef.current = onSetManualLocation;
  }, [onSetManualLocation]);

  useEffect(() => {
    if (selectedDistrictId) {
      setPickedDistrictId(selectedDistrictId);
    }
  }, [selectedDistrictId]);

  const initialCenter = useMemo<GeoCoordinate>(() => {
    if (userLocation) return userLocation;
    if (focusCoords) return focusCoords;
    return BANGLADESH_CENTER;
  }, [userLocation, focusCoords]);

  const closestDistanceKm = useMemo(() => {
    if (!userLocation || donors.length === 0) return null;
    const first = donors[0];
    const coords = getObfuscatedDonorCoords(
      first.districtId,
      first.uid,
      first.upazilaId
    );
    return haversineDistance(
      userLocation.lat,
      userLocation.lng,
      coords.lat,
      coords.lng
    );
  }, [donors, userLocation]);

  // 1. Initialize Leaflet Map once
  useEffect(() => {
    const container = mapHostRef.current;
    if (!container || mapInstanceRef.current) return;

    const bounds = L.latLngBounds(
      [BANGLADESH_MAP_BOUNDS.south, BANGLADESH_MAP_BOUNDS.west],
      [BANGLADESH_MAP_BOUNDS.north, BANGLADESH_MAP_BOUNDS.east]
    );

    const map = L.map(container, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: userLocation ? 12 : focusCoords ? 11 : 7,
      minZoom: 6,
      maxZoom: 19,
      maxBounds: bounds,
      maxBoundsViscosity: 0.7,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const donorLayer = L.layerGroup().addTo(map);
    donorLayerRef.current = donorLayer;

    map.on('dragstart', () => {
      setAutoFollow(false);
      setLayerMenuOpen(false);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setLayerMenuOpen(false);
      setShowUserInfoCard(false);
      setSelectedDonor(null);
      setAutoFollow(true);
      onSetManualLocationRef.current({ lat, lng });
    });

    mapInstanceRef.current = map;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      userMarkerRef.current = null;
      donorLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Manage Tile Layer + Automatic Fallback if a CDN fails
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    tileErrorCountRef.current = 0;
    const cfg = TILE_PROVIDERS[tileStyle];
    const layerOpts: L.TileLayerOptions = {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    };
    if (cfg.subdomains) {
      layerOpts.subdomains = cfg.subdomains;
    }
    const layer = L.tileLayer(cfg.url, layerOpts);

    layer.on('tileerror', () => {
      tileErrorCountRef.current += 1;
      if (tileErrorCountRef.current >= 5 && tileStyle === 'street') {
        setTileStyle('osm');
      }
    });

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [tileStyle]);

  // 3. Sync Camera with User Location or Selected Area
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation) return;
    if (!hasCenteredOnUserRef.current || autoFollow) {
      const targetZoom =
        !hasCenteredOnUserRef.current || map.getZoom() < 11
          ? 12
          : map.getZoom();
      map.setView([userLocation.lat, userLocation.lng], targetZoom, {
        animate: true,
      });
      hasCenteredOnUserRef.current = true;
    }
  }, [userLocation, autoFollow]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || userLocation || !focusCoords) return;
    const key = `${focusCoords.lat.toFixed(4)},${focusCoords.lng.toFixed(4)}`;
    if (lastFocusedKeyRef.current === key) return;
    lastFocusedKeyRef.current = key;
    map.setView([focusCoords.lat, focusCoords.lng], 11, { animate: true });
  }, [userLocation, focusCoords]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || recenterToken === 0) return;
    const target = userLocation || focusCoords;
    if (!target) return;
    const nextZoom = Math.max(map.getZoom(), 12);
    map.setView([target.lat, target.lng], nextZoom, {
      animate: true,
    });
  }, [userLocation, focusCoords, recenterToken]);

  // 4. Render / Update User Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!userLocation) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserDivIcon(),
        zIndexOffset: 1200,
      }).addTo(map);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setLayerMenuOpen(false);
        setSelectedDonor(null);
        setShowUserInfoCard(true);
      });
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation]);

  // 5. Render / Update Donor Markers
  useEffect(() => {
    const group = donorLayerRef.current;
    if (!group) return;

    group.clearLayers();

    donors.forEach((donor, index) => {
      const coords = getObfuscatedDonorCoords(
        donor.districtId,
        donor.uid,
        donor.upazilaId
      );
      const isSelected = selectedDonor?.uid === donor.uid;
      const isNearest = Boolean(userLocation && index === 0);

      const marker = L.marker([coords.lat, coords.lng], {
        icon: createDonorDivIcon(donor.bloodGroup, isSelected, isNearest),
        zIndexOffset: isSelected ? 1100 : Math.max(1, 500 - index),
        title: `${donor.displayName || 'রক্তদাতা'} (${sanitizeBloodGroup(
          donor.bloodGroup
        )})`,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setLayerMenuOpen(false);
        setShowUserInfoCard(false);
        setSelectedDonor(donor);
      });

      marker.addTo(group);
    });
  }, [donors, selectedDonor, userLocation]);

  const handleRecenter = () => {
    setLayerMenuOpen(false);
    setAutoFollow(true);
    setRecenterToken((t) => t + 1);
    onRequestLocation();
  };

  const handleQuickDistrictChange = (nextDistrictId: string) => {
    setPickedDistrictId(nextDistrictId);
    if (!nextDistrictId) return;
    const coords = getAreaCoords(nextDistrictId);
    if (!coords) return;
    const districtObj = DISTRICTS.find((d) => d.id === nextDistrictId);
    const districtLabel = districtObj
      ? `${districtObj[lang]}, ${lang === 'bn' ? 'বাংলাদেশ' : 'Bangladesh'}`
      : undefined;
    setShowUserInfoCard(false);
    setSelectedDonor(null);
    setAutoFollow(true);
    onSetManualLocation(coords, districtLabel);
  };

  const selectedDonorDistance = useMemo(() => {
    if (!selectedDonor || !userLocation) return null;
    const coords = getObfuscatedDonorCoords(
      selectedDonor.districtId,
      selectedDonor.uid,
      selectedDonor.upazilaId
    );
    return haversineDistance(
      userLocation.lat,
      userLocation.lng,
      coords.lat,
      coords.lng
    );
  }, [selectedDonor, userLocation]);

  return (
    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-neutral-200/90 shadow-sm bg-white">
      {/* =========================================================================
          Clean, Compact Above-Map Location & Quick District Control Header
         ========================================================================= */}
      <div className="p-3 sm:p-4 border-b border-neutral-200/80 bg-[#FAF8F9]/90 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Status & Resolved Address Info */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                userLocation && locationMode === 'gps'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : userLocation
                  ? 'bg-sky-50 border-sky-200 text-sky-700'
                  : locatingUser
                  ? 'bg-rose-50 border-rose-200 text-[#C80828]'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              {locatingUser ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : locationMode === 'gps' ? (
                <Navigation className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-0.5">
              {userLocation ? (
                <>
                  <div className="text-[11px] font-bold tracking-wide flex flex-wrap items-center gap-1.5">
                    {locationMode === 'gps' ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>
                          {lang === 'bn'
                            ? 'লাইভ GPS অবস্থান'
                            : 'Live GPS Active'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sky-800">
                        {lang === 'bn'
                          ? 'নির্বাচিত অবস্থান (নিকটবর্তী ডোনার)'
                          : 'Selected Area (Nearest First)'}
                      </span>
                    )}
                    {closestDistanceKm !== null && (
                      <span className="font-mono text-[#C80828]">
                        · {lang === 'bn' ? 'কাছে ' : 'Closest '}
                        {formatDistanceKm(closestDistanceKm, lang)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-neutral-900 leading-snug break-words">
                    {resolvingAddress && !userAddress ? (
                      <span className="inline-flex items-center gap-1.5 text-neutral-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>
                          {lang === 'bn'
                            ? 'ঠিকানা নির্ণয় হচ্ছে...'
                            : 'Resolving address...'}
                        </span>
                      </span>
                    ) : (
                      userAddress ||
                      (lang === 'bn' ? 'অবস্থান সক্রিয়' : 'Location Active')
                    )}
                  </div>
                </>
              ) : locatingUser ? (
                <>
                  <div className="text-[11px] font-bold text-[#C80828]">
                    {lang === 'bn'
                      ? 'লাইভ অবস্থান খোঁজা হচ্ছে...'
                      : 'Detecting Live Location...'}
                  </div>
                  <div className="text-xs text-neutral-600">
                    {lang === 'bn'
                      ? 'আপনার GPS ও এলাকার নাম নির্ণয় করা হচ্ছে'
                      : 'Locating your GPS coordinates & area'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-bold text-amber-800">
                    {lang === 'bn'
                      ? 'আপনার অবস্থান নির্ধারণ করুন'
                      : 'Set Your Location'}
                  </div>
                  <div className="text-xs text-neutral-700 leading-snug">
                    {lang === 'bn'
                      ? 'কাছের ডোনার দেখতে জেলা বেছে নিন অথবা GPS চালু করুন।'
                      : 'Select your district or allow GPS to sort nearest donors.'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick District Fallback Picker + GPS Button */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label={
                lang === 'bn' ? 'দ্রুত জেলা নির্বাচন করুন' : 'Quick select district'
              }
              value={pickedDistrictId}
              onChange={(e) => handleQuickDistrictChange(e.target.value)}
              className="flex-1 min-w-0 sm:flex-none sm:w-48 min-h-[38px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-300 rounded-xl text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#C80828]/30 cursor-pointer"
            >
              <option value="">
                {lang === 'bn'
                  ? 'জেলা বেছে নিন (৬৪ জেলা)'
                  : 'Select District (64)'}
              </option>
              {DISTRICTS.map((dist) => (
                <option key={dist.id} value={dist.id}>
                  {dist[lang]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRecenter}
              disabled={locatingUser}
              className="min-h-[38px] px-3 sm:px-3.5 py-1.5 bg-[#C80828] hover:bg-[#A0051E] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
            >
              <Crosshair
                className={`w-3.5 h-3.5 ${locatingUser ? 'animate-spin' : ''}`}
              />
              <span>
                {userLocation && locationMode === 'gps'
                  ? lang === 'bn'
                    ? 'GPS আপডেট'
                    : 'Refresh GPS'
                  : lang === 'bn'
                  ? 'GPS চালু'
                  : 'Use GPS'}
              </span>
            </button>
          </div>
        </div>

        {/* Always-Visible GPS Alert Banner (even when a manual district is already selected) */}
        {locationError && (
          <div
            role="status"
            className="flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-snug"
          >
            <div className="flex items-start gap-1.5 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <span>{locationError}</span>
            </div>
            {onDismissLocationError && (
              <button
                type="button"
                onClick={onDismissLocationError}
                aria-label="Dismiss"
                className="w-5 h-5 rounded-md hover:bg-amber-200/60 text-amber-800 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#C80828] shrink-0" />
          <span className="truncate sm:whitespace-normal">
            {lang === 'bn'
              ? 'ম্যাপের যেকোনো স্থানে ট্যাপ করলেই অবস্থান পিন হবে ও কাছের ডোনার সাজাবে।'
              : 'Tap anywhere on the map to drop your pin and sort donors nearest-first.'}
          </span>
        </p>
      </div>

      {/* =========================================================================
          100% Free Esri / OpenStreetMap Leaflet Canvas (Stacking-Isolated)
         ========================================================================= */}
      <AppErrorBoundary
        variant="inline"
        lang={lang}
        fallbackTitleBn="ম্যাপ লোড করতে সমস্যা হয়েছে"
        fallbackTitleEn="Could not render map"
        fallbackMessageBn="আপনার ডিভাইসে ম্যাপ ক্যানভাস চালু করা যায়নি, তবে উপরের জেলা নির্বাচক ও নিচের রক্তদাতা তালিকা সম্পূর্ণ সচল আছে।"
        fallbackMessageEn="Could not initialize the map canvas on this device, while district selection and donor cards below remain active."
      >
        <div className="relative isolate w-full h-[380px] sm:h-[480px] bg-[#eae8e1]">
          <div ref={mapHostRef} className="w-full h-full z-0" />

          {/* Top-Left Collapsible Layer Icon Button + Drawer Menu (3 options tucked inside) */}
          <div className="absolute top-3 left-3 z-[1000]">
            <button
              type="button"
              onClick={() => setLayerMenuOpen((prev) => !prev)}
              aria-expanded={layerMenuOpen}
              aria-label={lang === 'bn' ? 'ম্যাপের ধরন পরিবর্তন করুন' : 'Change map layer'}
              title={lang === 'bn' ? 'ম্যাপের ধরন' : 'Map layers'}
              className={`w-10 h-10 rounded-xl border shadow-md flex items-center justify-center cursor-pointer transition-colors ${
                layerMenuOpen
                  ? 'bg-[#C80828] border-[#C80828] text-white'
                  : 'bg-white/95 hover:bg-white border-neutral-200/90 text-[#C80828]'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>

            {layerMenuOpen && (
              <div className="mt-2 w-40 bg-white/95 backdrop-blur-xs border border-neutral-200/90 rounded-2xl shadow-xl p-1.5 space-y-1">
                {(['street', 'osm', 'satellite'] as const).map((styleKey) => {
                  const active = tileStyle === styleKey;
                  const meta = TILE_PROVIDERS[styleKey];
                  return (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => {
                        setTileStyle(styleKey);
                        setLayerMenuOpen(false);
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#C80828] text-white'
                          : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      <span>{lang === 'bn' ? meta.labelBn : meta.labelEn}</span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top-Right Recenter & Live GPS Button */}
          <button
            type="button"
            onClick={handleRecenter}
            disabled={locatingUser}
            title={
              lang === 'bn' ? 'আমার লাইভ GPS অবস্থানে যান' : 'Center on live GPS'
            }
            className={`absolute top-3 right-3 z-[1000] h-10 px-3 border rounded-xl shadow-md flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-60 ${
              locationMode === 'gps'
                ? 'bg-white/95 hover:bg-white text-emerald-700 border-emerald-200'
                : 'bg-white/95 hover:bg-white text-neutral-800 border-neutral-200/90'
            }`}
          >
            <Crosshair
              className={`w-4 h-4 ${
                locatingUser
                  ? 'animate-spin text-[#C80828]'
                  : locationMode === 'gps'
                  ? 'text-emerald-600'
                  : 'text-[#C80828]'
              }`}
            />
            <span className="hidden sm:inline">
              {lang === 'bn' ? 'আমার অবস্থান' : 'My Location'}
            </span>
          </button>

          {/* Bottom-Left Compact Map Legend (Desktop / Tablet when no popup card is open) */}
          {!selectedDonor && !showUserInfoCard && (
            <div className="absolute bottom-4 left-3 z-[500] bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl shadow-md border border-neutral-200 text-xs space-y-1 pointer-events-none hidden sm:block">
              <div className="font-semibold text-neutral-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#C80828]" />
                <span>{lang === 'bn' ? 'ম্যাপ নির্দেশিকা' : 'Map Legend'}</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C80828]" />
                <span>
                  {lang === 'bn' ? 'স্বেচ্ছায় রক্তদাতা' : 'Voluntary Donor'}
                </span>
              </div>
              {userLocation && (
                <div className="flex items-center gap-2 text-neutral-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>{lang === 'bn' ? 'আপনার অবস্থান' : 'Your Location'}</span>
                </div>
              )}
              {closestDistanceKm !== null && (
                <div className="pt-0.5 text-[11px] font-semibold text-emerald-700">
                  {lang === 'bn' ? 'সবচেয়ে কাছে: ' : 'Closest: '}
                  {formatDistanceKm(closestDistanceKm, lang)}
                </div>
              )}
            </div>
          )}

          {/* XSS-Safe Floating React Info Card: Selected Donor */}
          {selectedDonor && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 z-[1000] bg-white rounded-2xl border border-neutral-200 shadow-xl p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#C80828] text-white flex items-center justify-center font-bold font-mono text-xs shrink-0">
                    {sanitizeBloodGroup(selectedDonor.bloodGroup)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#1F242D] truncate">
                      {selectedDonor.displayName || 'রক্তদাতা'}
                    </h4>
                    {selectedDonor.username && (
                      <p className="text-[11px] font-mono text-neutral-500 truncate">
                        @{selectedDonor.username}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDonor(null)}
                  aria-label="Close"
                  className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 text-xs text-neutral-600">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">
                    {formatLocationLabel(
                      selectedDonor.divisionId,
                      selectedDonor.districtId,
                      selectedDonor.upazilaId,
                      lang
                    )}
                  </span>
                </div>

                {selectedDonorDistance !== null && (
                  <div className="flex items-center gap-1.5 text-[#C80828] font-medium">
                    <Crosshair className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatDistanceKm(selectedDonorDistance, lang)}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-neutral-500">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>
                    {getDonorTier(selectedDonor.totalDonationsCount || 0)[
                      lang === 'bn' ? 'nameBn' : 'nameEn'
                    ]}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectDonor(selectedDonor)}
                className="w-full min-h-[38px] px-3 py-1.5 bg-[#C80828] hover:bg-[#a3051e] text-white font-semibold text-xs rounded-xl text-center cursor-pointer transition-colors shadow-2xs"
              >
                {lang === 'bn' ? 'প্রোফাইল ও যোগাযোগ দেখুন' : 'View Profile & Contact'}
              </button>
            </div>
          )}

          {/* XSS-Safe Floating React Info Card: User Location */}
          {showUserInfoCard && userLocation && !selectedDonor && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 z-[1000] bg-white rounded-2xl border border-neutral-200 shadow-xl p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                  <Crosshair className="w-4 h-4 shrink-0" />
                  <span>
                    {locationMode === 'gps'
                      ? lang === 'bn'
                        ? 'আপনার বর্তমান লাইভ অবস্থান'
                        : 'Your Live Location'
                      : lang === 'bn'
                      ? 'আপনার নির্বাচিত অবস্থান'
                      : 'Selected Location'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUserInfoCard(false)}
                  aria-label="Close"
                  className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-neutral-700 leading-snug">
                {userAddress ||
                  (lang === 'bn' ? 'অবস্থান সক্রিয়' : 'Location Active')}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${userLocation.lat},${userLocation.lng}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C80828] hover:underline"
              >
                <span>
                  {lang === 'bn'
                    ? 'ম্যাপ অ্যাপে লোকেশন খুলুন'
                    : 'Open in External Map App'}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </AppErrorBoundary>
    </div>
  );
}
