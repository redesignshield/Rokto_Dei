import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Award,
  Crosshair,
  Info,
  Loader2,
  MapPin,
  Navigation,
} from 'lucide-react';
import { DISTRICTS, formatLocationLabel } from '../data/bdLocations';
import firebaseConfig from '../../firebase-applet-config.json';
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
  onSelectDonor: (donor: DonorProfile) => void;
  lang: 'bn' | 'en';
}

function MapCameraSync({
  userLocation,
  focusCoords,
  recenterToken,
  onManualDrag,
  autoFollow,
}: {
  userLocation: GeoCoordinate | null;
  focusCoords?: GeoCoordinate | null;
  recenterToken: number;
  onManualDrag: () => void;
  autoFollow: boolean;
}) {
  const map = useMap();
  const hasCenteredOnUserRef = useRef(false);
  const lastFocusedKeyRef = useRef<string>('');

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('dragstart', () => {
      onManualDrag();
    });
    return () => {
      listener.remove();
    };
  }, [map, onManualDrag]);

  // Follow user location (GPS or manual pin/district pick)
  useEffect(() => {
    if (!map || !userLocation) return;
    if (!hasCenteredOnUserRef.current || autoFollow) {
      map.panTo(userLocation);
      const curZoom = map.getZoom();
      if (!hasCenteredOnUserRef.current || !curZoom || curZoom < 11) {
        map.setZoom(12);
      }
      hasCenteredOnUserRef.current = true;
    }
  }, [map, userLocation, autoFollow]);

  // If no userLocation yet, smoothly pan to filtered district/upazila focusCoords
  useEffect(() => {
    if (!map || userLocation || !focusCoords) return;
    const key = `${focusCoords.lat.toFixed(4)},${focusCoords.lng.toFixed(4)}`;
    if (lastFocusedKeyRef.current === key) return;
    lastFocusedKeyRef.current = key;
    map.panTo(focusCoords);
    map.setZoom(11);
  }, [map, userLocation, focusCoords]);

  // Explicit recenter button press
  useEffect(() => {
    if (!map || !userLocation || recenterToken === 0) return;
    map.panTo(userLocation);
    const curZoom = map.getZoom();
    if (!curZoom || curZoom < 12) {
      map.setZoom(13);
    }
  }, [map, userLocation, recenterToken]);

  return null;
}

function DonorMarker({
  donor,
  isSelected,
  isNearest,
  zIndex,
  onClick,
}: {
  donor: DonorProfile;
  isSelected: boolean;
  isNearest: boolean;
  zIndex: number;
  onClick: () => void;
}) {
  const coords = useMemo(
    () =>
      getObfuscatedDonorCoords(donor.districtId, donor.uid, donor.upazilaId),
    [donor.districtId, donor.uid, donor.upazilaId]
  );

  return (
    <AdvancedMarker position={coords} zIndex={zIndex} onClick={onClick}>
      <div
        className={`relative flex items-center justify-center cursor-pointer transition-transform duration-200 select-none ${
          isSelected ? 'scale-125' : 'hover:scale-110'
        }`}
        title={`${donor.displayName} (${donor.bloodGroup})`}
      >
        <div className="relative">
          <div
            className={`relative w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-md border-2 ${
              isSelected
                ? 'bg-[#99061e] text-white border-white ring-4 ring-[#C80828]/40'
                : isNearest
                ? 'bg-[#C80828] text-white border-emerald-300 ring-2 ring-emerald-500/45'
                : 'bg-[#C80828] text-white border-white hover:bg-[#a3051e]'
            }`}
          >
            {donor.bloodGroup}
          </div>
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#C80828] mx-auto -mt-0.5" />
        </div>
      </div>
    </AdvancedMarker>
  );
}

function UserLocationMarker({
  position,
  onClick,
}: {
  position: GeoCoordinate;
  onClick: () => void;
}) {
  return (
    <AdvancedMarker position={position} zIndex={1200} onClick={onClick}>
      <div className="relative flex items-center justify-center cursor-pointer">
        <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        </div>
      </div>
    </AdvancedMarker>
  );
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
  onSelectDonor,
  lang,
}: DonorMapComponentProps) {
  const [selectedDonor, setSelectedDonor] = useState<DonorProfile | null>(null);
  const [showUserInfoWindow, setShowUserInfoWindow] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [recenterToken, setRecenterToken] = useState(0);
  const [pickedDistrictId, setPickedDistrictId] = useState(selectedDistrictId);

  useEffect(() => {
    if (selectedDistrictId) {
      setPickedDistrictId(selectedDistrictId);
    }
  }, [selectedDistrictId]);

  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || firebaseConfig.apiKey || '';

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

  const handleRecenter = () => {
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
    setShowUserInfoWindow(false);
    setSelectedDonor(null);
    setAutoFollow(true);
    onSetManualLocation(coords, districtLabel);
  };

  const handleMapTap = (latLng: { lat: number; lng: number } | null | undefined) => {
    if (!latLng) return;
    setShowUserInfoWindow(false);
    setSelectedDonor(null);
    setAutoFollow(true);
    onSetManualLocation({ lat: latLng.lat, lng: latLng.lng });
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-neutral-200/90 shadow-sm bg-white">
      {/* =========================================================================
          Clean Above-Map Location & Quick District Control Header (Zero Tile Overlap)
         ========================================================================= */}
      <div className="p-3.5 sm:p-4 border-b border-neutral-200/80 bg-[#FAF8F9]/90 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status & Resolved Address Info */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                userLocation
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
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
                  <div className="text-[11px] font-bold tracking-wide text-emerald-700 flex flex-wrap items-center gap-1.5">
                    <span>
                      {locationMode === 'gps'
                        ? lang === 'bn'
                          ? 'আপনার লাইভ GPS অবস্থান'
                          : 'Your Live GPS Location'
                        : lang === 'bn'
                        ? 'নির্বাচিত অবস্থান (নিকটবর্তী ডোনার সাজানো)'
                        : 'Selected Location (Nearest First)'}
                    </span>
                    {closestDistanceKm !== null && (
                      <span className="font-mono text-[#C80828]">
                        · {lang === 'bn' ? 'সবচেয়ে কাছে ' : 'Closest '}
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
                      ? 'অবস্থান খোঁজা হচ্ছে'
                      : 'Detecting Location'}
                  </div>
                  <div className="text-xs text-neutral-700">
                    {lang === 'bn'
                      ? 'আপনার লাইভ অবস্থান ও ঠিকানা নির্ণয় করা হচ্ছে...'
                      : 'Detecting your live location and street address...'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[11px] font-bold text-amber-800">
                    {lang === 'bn'
                      ? 'আপনার অবস্থান নির্ধারণ করুন'
                      : 'Set Your Location'}
                  </div>
                  <div className="text-xs text-neutral-700 leading-relaxed">
                    {locationError ||
                      (lang === 'bn'
                        ? 'কাছের রক্তদাতা আগে দেখতে জেলা বেছে নিন অথবা GPS চালু করুন।'
                        : 'Select your district or allow GPS to sort nearest donors first.')}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick District Fallback Picker + GPS Retry Button */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            <select
              aria-label={
                lang === 'bn' ? 'দ্রুত জেলা নির্বাচন করুন' : 'Quick select district'
              }
              value={pickedDistrictId}
              onChange={(e) => handleQuickDistrictChange(e.target.value)}
              className="flex-1 sm:flex-none sm:w-48 min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-white border border-neutral-300 rounded-xl text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#C80828]/30 cursor-pointer"
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
              className="min-h-[40px] px-3.5 py-1.5 bg-[#C80828] hover:bg-[#A0051E] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer transition-colors inline-flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
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

        <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#C80828] shrink-0" />
          <span>
            {lang === 'bn'
              ? 'টিপস: ম্যাপের যেকোনো স্থানে ট্যাপ করলেও আপনার অবস্থান পিন হবে এবং সবচেয়ে কাছের ডোনার থেকে দূরে সাজানো দেখাবে।'
              : 'Tip: Tap anywhere on the map to drop your location pin and sort donors from nearest to farthest.'}
          </span>
        </p>
      </div>

      {/* =========================================================================
          Clean, Unobstructed Real-Time Google Map Container
         ========================================================================= */}
      <div className="relative w-full h-[380px] sm:h-[480px] bg-neutral-100">
        <APIProvider
          apiKey={apiKey}
          libraries={['marker']}
          language={lang}
          region="BD"
        >
          <GoogleMap
            defaultCenter={initialCenter}
            defaultZoom={userLocation ? 12 : focusCoords ? 11 : 7}
            minZoom={6}
            restriction={{
              latLngBounds: BANGLADESH_MAP_BOUNDS,
              strictBounds: false,
            }}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            gestureHandling="greedy"
            disableDefaultUI={false}
            onClick={(e) => handleMapTap(e.detail?.latLng)}
            style={{ width: '100%', height: '100%' }}
          >
            <MapCameraSync
              userLocation={userLocation}
              focusCoords={focusCoords}
              recenterToken={recenterToken}
              autoFollow={autoFollow}
              onManualDrag={() => setAutoFollow(false)}
            />

            {userLocation && (
              <UserLocationMarker
                position={userLocation}
                onClick={() => {
                  setSelectedDonor(null);
                  setShowUserInfoWindow(true);
                }}
              />
            )}

            {showUserInfoWindow && userLocation && (
              <InfoWindow
                position={userLocation}
                onCloseClick={() => setShowUserInfoWindow(false)}
                headerContent={null}
              >
                <div className="p-1 max-w-[240px] text-neutral-900 font-sans space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                    <Crosshair className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {locationMode === 'gps'
                        ? lang === 'bn'
                          ? 'আপনার বর্তমান অবস্থান'
                          : 'Your Current Location'
                        : lang === 'bn'
                        ? 'আপনার নির্বাচিত অবস্থান'
                        : 'Selected Location'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-snug">
                    {userAddress ||
                      (lang === 'bn'
                        ? 'ঠিকানা নির্ণয় হচ্ছে...'
                        : 'Resolving address...')}
                  </p>
                </div>
              </InfoWindow>
            )}

            {donors.map((donor, index) => (
              <DonorMarker
                key={donor.uid}
                donor={donor}
                isSelected={selectedDonor?.uid === donor.uid}
                isNearest={Boolean(userLocation && index === 0)}
                zIndex={
                  selectedDonor?.uid === donor.uid
                    ? 1100
                    : Math.max(1, 500 - index)
                }
                onClick={() => {
                  setShowUserInfoWindow(false);
                  setSelectedDonor(donor);
                }}
              />
            ))}

            {selectedDonor && (
              <InfoWindow
                position={getObfuscatedDonorCoords(
                  selectedDonor.districtId,
                  selectedDonor.uid,
                  selectedDonor.upazilaId
                )}
                onCloseClick={() => setSelectedDonor(null)}
                headerContent={null}
              >
                <div className="p-1 max-w-[260px] text-neutral-900 font-sans">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-[#C80828] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {selectedDonor.bloodGroup}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#1F242D] truncate">
                        {selectedDonor.displayName}
                      </h4>
                      {selectedDonor.username && (
                        <p className="text-[11px] font-mono text-neutral-500 truncate">
                          @{selectedDonor.username}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-neutral-600 mb-2.5">
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

                    {userLocation && (
                      <div className="flex items-center gap-1.5 text-[#C80828] font-medium">
                        <Crosshair className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {formatDistanceKm(
                            haversineDistance(
                              userLocation.lat,
                              userLocation.lng,
                              getObfuscatedDonorCoords(
                                selectedDonor.districtId,
                                selectedDonor.uid,
                                selectedDonor.upazilaId
                              ).lat,
                              getObfuscatedDonorCoords(
                                selectedDonor.districtId,
                                selectedDonor.uid,
                                selectedDonor.upazilaId
                              ).lng
                            ),
                            lang
                          )}
                        </span>
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

                  <div className="pt-1 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => onSelectDonor(selectedDonor)}
                      className="w-full px-3 py-1.5 bg-[#C80828] text-white font-semibold text-xs rounded-lg hover:bg-[#a3051e] text-center cursor-pointer transition-colors shadow-2xs"
                    >
                      {lang === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </APIProvider>

        {/* Compact Top-Right Recenter GPS Button */}
        <button
          type="button"
          onClick={handleRecenter}
          disabled={locatingUser}
          title={
            lang === 'bn' ? 'আমার অবস্থানে ম্যাপ আনুন' : 'Center on my location'
          }
          className="absolute top-3 right-3 z-10 h-10 px-3 bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200/90 rounded-xl shadow-md flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-60"
        >
          <Crosshair
            className={`w-4 h-4 text-[#C80828] ${
              locatingUser ? 'animate-spin' : ''
            }`}
          />
          <span className="hidden sm:inline">
            {lang === 'bn' ? 'আমার অবস্থান' : 'My Location'}
          </span>
        </button>

        {/* Bottom-Left Compact Map Legend (Desktop / Tablet) */}
        <div className="absolute bottom-4 left-3 bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl shadow-md border border-neutral-200 text-xs space-y-1 pointer-events-none hidden sm:block">
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
      </div>
    </div>
  );
}
