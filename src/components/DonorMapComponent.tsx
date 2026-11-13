import React, { useCallback, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Award,
  CheckCircle2,
  Crosshair,
  Droplet,
  ExternalLink,
  Info,
  MapPin,
  Maximize2,
  Phone,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  formatLocationLabel,
  getDistrictById,
  getDivisionById,
} from '../data/bdLocations';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BANGLADESH_CENTER,
  formatDistanceKm,
  getObfuscatedDonorCoords,
  haversineDistance,
  type GeoCoordinate,
} from '../lib/geoUtils';
import { getDonorTier } from '../lib/donorBadge';
import type { BloodGroup, DonorProfile } from '../types';

interface DonorMapComponentProps {
  donors: DonorProfile[];
  userLocation: GeoCoordinate | null;
  selectedRadiusKm: number | null; // null means 'all'
  onSelectDonor: (donor: DonorProfile) => void;
  lang: 'bn' | 'en';
}

// Marker component for each voluntary donor
function DonorMarker({
  donor,
  isSelected,
  onClick,
}: {
  donor: DonorProfile;
  isSelected: boolean;
  onClick: () => void;
}) {
  const coords = useMemo(
    () => getObfuscatedDonorCoords(donor.districtId, donor.uid),
    [donor.districtId, donor.uid]
  );

  return (
    <AdvancedMarker position={coords} onClick={onClick}>
      <div
        className={`relative flex items-center justify-center cursor-pointer transition-transform duration-200 select-none ${
          isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-10'
        }`}
        title={`${donor.displayName} (${donor.bloodGroup})`}
      >
        {/* Animated Beacon Pin */}
        <div className="relative">
          <div
            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-md border-2 ${
              isSelected
                ? 'bg-[#99061e] text-white border-white ring-4 ring-[#C80828]/40'
                : 'bg-[#C80828] text-white border-white hover:bg-[#a3051e]'
            }`}
          >
            {donor.bloodGroup}
          </div>
          {/* Bottom pointer triangle */}
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#C80828] mx-auto -mt-0.5" />
        </div>
      </div>
    </AdvancedMarker>
  );
}

// Marker for user's active GPS location
function UserLocationMarker({ position }: { position: GeoCoordinate }) {
  return (
    <AdvancedMarker position={position}>
      <div className="relative flex items-center justify-center">
        <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75" />
        <div className="relative w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      </div>
    </AdvancedMarker>
  );
}

export function DonorMapComponent({
  donors,
  userLocation,
  selectedRadiusKm,
  onSelectDonor,
  lang,
}: DonorMapComponentProps) {
  const [selectedDonor, setSelectedDonor] = useState<DonorProfile | null>(null);

  // Maps API Key from environment or fallback to provisioned firebase key
  const apiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || firebaseConfig.apiKey || '';

  // Center on user location if available, else Bangladesh capital
  const mapCenter = useMemo<GeoCoordinate>(() => {
    if (userLocation) return userLocation;
    return BANGLADESH_CENTER;
  }, [userLocation]);

  const defaultZoom = userLocation ? 10 : 7;

  return (
    <div className="relative w-full h-[520px] sm:h-[600px] rounded-2xl overflow-hidden border border-neutral-200 shadow-sm bg-neutral-100">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={defaultZoom}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="w-full h-full"
        >
          {/* User Location Marker */}
          {userLocation && <UserLocationMarker position={userLocation} />}

          {/* Donor Markers */}
          {donors.map((donor) => (
            <DonorMarker
              key={donor.uid}
              donor={donor}
              isSelected={selectedDonor?.uid === donor.uid}
              onClick={() => setSelectedDonor(donor)}
            />
          ))}

          {/* Active Donor InfoWindow */}
          {selectedDonor && (
            <InfoWindow
              position={getObfuscatedDonorCoords(
                selectedDonor.districtId,
                selectedDonor.uid
              )}
              onCloseClick={() => setSelectedDonor(null)}
              headerContent={null}
            >
              <div className="p-1 max-w-[260px] text-neutral-900 font-sans">
                {/* Header with Blood Group & Name */}
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

                {/* Location & Distance */}
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
                              selectedDonor.uid
                            ).lat,
                            getObfuscatedDonorCoords(
                              selectedDonor.districtId,
                              selectedDonor.uid
                            ).lng
                          ),
                          lang
                        )}
                      </span>
                    </div>
                  )}

                  {/* Recognition Tier */}
                  <div className="flex items-center gap-1.5 text-neutral-500">
                    <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>
                      {getDonorTier(selectedDonor.totalDonationsCount || 0)[
                        lang === 'bn' ? 'nameBn' : 'nameEn'
                      ]}
                    </span>
                  </div>
                </div>

                {/* Actions inside popup */}
                <div className="pt-1 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDonor(selectedDonor);
                    }}
                    className="w-full px-3 py-1.5 bg-[#C80828] text-white font-semibold text-xs rounded-lg hover:bg-[#a3051e] text-center cursor-pointer transition-colors shadow-2xs"
                  >
                    {lang === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>

      {/* Map Legend Overlay at Bottom-Left */}
      <div className="absolute bottom-4 left-3 bg-white/95 backdrop-blur-xs px-3 py-2 rounded-xl shadow-md border border-neutral-200 text-xs space-y-1 pointer-events-none hidden sm:block">
        <div className="font-semibold text-neutral-800 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#C80828]" />
          <span>{lang === 'bn' ? 'ম্যাপ নির্দেশিকা' : 'Map Legend'}</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-600">
          <span className="w-2.5 h-2.5 rounded-full bg-[#C80828]" />
          <span>{lang === 'bn' ? 'স্বেচ্ছায় রক্তদাতা' : 'Voluntary Donor'}</span>
        </div>
        {userLocation && (
          <div className="flex items-center gap-2 text-neutral-600">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span>{lang === 'bn' ? 'আপনার অবস্থান' : 'Your Location'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
