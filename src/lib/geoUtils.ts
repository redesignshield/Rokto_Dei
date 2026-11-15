// Bangladesh District Geo-Centroids & Haversine Distance Calculator
// Designed with Cyber-Security & Privacy: Obfuscates exact donor coordinates
// to prevent stalking while enabling accurate distance sorting and radius filters.

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

// Bangladesh District Centroids (64 Districts)
export const BANGLADESH_DISTRICT_COORDINATES: Record<string, GeoCoordinate> = {
  // Dhaka Division
  dhaka: { lat: 23.8103, lng: 90.4125 },
  gazipur: { lat: 23.9989, lng: 90.4203 },
  narayanganj: { lat: 23.6238, lng: 90.5000 },
  tangail: { lat: 24.2513, lng: 89.9167 },
  kishoreganj: { lat: 24.4449, lng: 90.7766 },
  manikganj: { lat: 23.8644, lng: 90.0047 },
  munshiganj: { lat: 23.5422, lng: 90.5305 },
  narsingdi: { lat: 23.9193, lng: 90.7176 },
  faridpur: { lat: 23.6071, lng: 89.8429 },
  gopalganj: { lat: 23.0051, lng: 89.8266 },
  madaripur: { lat: 23.1641, lng: 90.1897 },
  rajbari: { lat: 23.7574, lng: 89.6445 },
  shariatpur: { lat: 23.2423, lng: 90.4348 },

  // Chattogram Division
  chattogram: { lat: 22.3569, lng: 91.7832 },
  coxs_bazar: { lat: 21.4272, lng: 92.0058 },
  cumilla: { lat: 23.4607, lng: 91.1809 },
  brahmanbaria: { lat: 23.9571, lng: 91.1119 },
  chandpur: { lat: 23.2333, lng: 90.6667 },
  noakhali: { lat: 22.8696, lng: 91.0991 },
  feni: { lat: 23.0159, lng: 91.3976 },
  lakshmipur: { lat: 22.9425, lng: 90.8412 },
  bandarban: { lat: 22.1953, lng: 92.2184 },
  khagrachhari: { lat: 23.1193, lng: 91.9847 },
  rangamati: { lat: 22.6533, lng: 92.1753 },

  // Rajshahi Division
  rajshahi: { lat: 24.3745, lng: 88.6042 },
  bogura: { lat: 24.8465, lng: 89.3777 },
  pabna: { lat: 24.0064, lng: 89.2372 },
  sirajganj: { lat: 24.4534, lng: 89.7007 },
  naogaon: { lat: 24.7936, lng: 88.9318 },
  natore: { lat: 24.4206, lng: 88.9324 },
  chapai_nawabganj: { lat: 24.5965, lng: 88.2775 },
  joypurhat: { lat: 25.1015, lng: 89.0277 },

  // Khulna Division
  khulna: { lat: 22.8456, lng: 89.5403 },
  jessore: { lat: 23.1664, lng: 89.2081 },
  kushtia: { lat: 23.9013, lng: 89.1205 },
  satkhira: { lat: 22.7185, lng: 89.0705 },
  bagerhat: { lat: 22.6516, lng: 89.7859 },
  chuadanga: { lat: 23.6402, lng: 88.8418 },
  jhenaidah: { lat: 23.5448, lng: 89.1539 },
  magura: { lat: 23.4873, lng: 89.4198 },
  meherpur: { lat: 23.7622, lng: 88.6318 },
  narail: { lat: 23.1725, lng: 89.5127 },

  // Barishal Division
  barishal: { lat: 22.7010, lng: 90.3535 },
  bhola: { lat: 22.6859, lng: 90.6482 },
  patuakhali: { lat: 22.3596, lng: 90.3299 },
  pirojpur: { lat: 22.5841, lng: 89.9720 },
  barguna: { lat: 22.0953, lng: 90.1121 },
  jhalokati: { lat: 22.6406, lng: 90.1987 },

  // Sylhet Division
  sylhet: { lat: 24.8949, lng: 91.8687 },
  moulvibazar: { lat: 24.4829, lng: 91.7774 },
  habiganj: { lat: 24.3749, lng: 91.4155 },
  sunamganj: { lat: 25.0658, lng: 91.3950 },

  // Rangpur Division
  rangpur: { lat: 25.7439, lng: 89.2752 },
  dinajpur: { lat: 25.6217, lng: 88.6355 },
  gaibandha: { lat: 25.3288, lng: 89.5408 },
  kurigram: { lat: 25.8054, lng: 89.6362 },
  lalmonirhat: { lat: 25.9923, lng: 89.2847 },
  nilphamari: { lat: 25.9318, lng: 88.8560 },
  panchagarh: { lat: 26.3411, lng: 88.5542 },
  thakurgaon: { lat: 26.0337, lng: 88.4617 },

  // Mymensingh Division
  mymensingh: { lat: 24.7471, lng: 90.4203 },
  jamalpur: { lat: 24.9375, lng: 89.9378 },
  netrokona: { lat: 24.8709, lng: 90.7279 },
  sherpur: { lat: 25.0205, lng: 90.0153 },
};

// Major Upazila / City Thana Centroids for finer nearest-to-farthest proximity sorting
export const BANGLADESH_UPAZILA_COORDINATES: Record<string, GeoCoordinate> = {
  // Dhaka Metro & Suburbs
  dhanmondi: { lat: 23.7461, lng: 90.3742 },
  mirpur: { lat: 23.8223, lng: 90.3654 },
  uttara: { lat: 23.8759, lng: 90.3795 },
  mohammadpur: { lat: 23.7662, lng: 90.3589 },
  gulshan: { lat: 23.7925, lng: 90.4078 },
  banani: { lat: 23.7937, lng: 90.4066 },
  motijheel: { lat: 23.7330, lng: 90.4172 },
  shahbagh: { lat: 23.7389, lng: 90.3958 },
  ramna: { lat: 23.7438, lng: 90.4027 },
  tejgaon: { lat: 23.7600, lng: 90.3914 },
  badda: { lat: 23.7805, lng: 90.4267 },
  khilgaon: { lat: 23.7567, lng: 90.4400 },
  jatrabari: { lat: 23.7104, lng: 90.4349 },
  lalbagh: { lat: 23.7189, lng: 90.3881 },
  savar: { lat: 23.8583, lng: 90.2667 },
  keraniganj: { lat: 23.6948, lng: 90.3347 },
  dhamrai: { lat: 23.9137, lng: 90.2179 },
  dohar: { lat: 23.5975, lng: 90.1456 },
  nawabganj_dhaka: { lat: 23.6664, lng: 90.1753 },

  // Gazipur & Narayanganj
  gazipur_sadar: { lat: 23.9999, lng: 90.4203 },
  tongi: { lat: 23.8977, lng: 90.4023 },
  kaliakair: { lat: 24.0750, lng: 90.2167 },
  sreepur_gazipur: { lat: 24.1981, lng: 90.4714 },
  narayanganj_sadar: { lat: 23.6238, lng: 90.5000 },
  siddhirganj: { lat: 23.6808, lng: 90.5178 },
  fatullah: { lat: 23.6428, lng: 90.4831 },
  rupganj: { lat: 23.7925, lng: 90.5150 },

  // Chattogram City & Hubs
  panchlaish: { lat: 22.3688, lng: 91.8329 },
  kotwali_ctg: { lat: 22.3375, lng: 91.8389 },
  agrabad: { lat: 22.3264, lng: 91.8117 },
  halishahar: { lat: 22.3372, lng: 91.7875 },
  patenga: { lat: 22.2442, lng: 91.7975 },
  nasirabad: { lat: 22.3682, lng: 91.8184 },
  chandgaon: { lat: 22.3752, lng: 91.8606 },
  sitakunda: { lat: 22.6200, lng: 91.6589 },
  hathazari: { lat: 22.5072, lng: 91.8056 },
};

// Default center of Bangladesh (National Capital)
export const BANGLADESH_CENTER: GeoCoordinate = {
  lat: 23.8103,
  lng: 90.4125,
};

// Soft bounding box keeping Google Maps focused cleanly on Bangladesh
export const BANGLADESH_MAP_BOUNDS = {
  north: 26.85,
  south: 20.35,
  west: 87.85,
  east: 92.85,
} as const;

export function getAreaCoords(
  districtId?: string,
  upazilaId?: string
): GeoCoordinate | null {
  if (upazilaId && BANGLADESH_UPAZILA_COORDINATES[upazilaId]) {
    return BANGLADESH_UPAZILA_COORDINATES[upazilaId];
  }
  if (districtId && BANGLADESH_DISTRICT_COORDINATES[districtId]) {
    return BANGLADESH_DISTRICT_COORDINATES[districtId];
  }
  return null;
}

/**
 * Calculates straight-line distance in kilometers between two geo coordinates
 * using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Round to 1 decimal place
}

/**
 * Simple deterministic hash from string to integer (0 - 999999)
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * CYBER-SECURITY & PRIVACY REQUIREMENT:
 * Derives a privacy-preserving obfuscated coordinate for a donor.
 * Anchors to upazila/thana centroid when mapped (falling back to district centroid)
 * and adds a small deterministic micro-jitter (~300m - 800m) based on donor UID
 * so multiple donors in the same area don't overlap on the map while keeping
 * exact residential coordinates private.
 */
export function getObfuscatedDonorCoords(
  districtId: string,
  donorUid: string,
  upazilaId?: string
): GeoCoordinate {
  const base =
    (upazilaId ? BANGLADESH_UPAZILA_COORDINATES[upazilaId] : undefined) ||
    BANGLADESH_DISTRICT_COORDINATES[districtId] ||
    BANGLADESH_CENTER;
  const seed = hashString(donorUid || districtId);

  // Generate deterministic offset: angle 0 to 2*PI, radius ~0.3km to ~0.8km
  const angle = ((seed % 360) * Math.PI) / 180;
  const distanceKm = 0.3 + ((seed % 500) / 1000); // 0.3km to 0.8km

  // 1 deg lat ~ 111km, 1 deg lng ~ 111km * cos(lat)
  const latOffset = (distanceKm * Math.cos(angle)) / 111;
  const lngOffset =
    (distanceKm * Math.sin(angle)) /
    (111 * Math.cos((base.lat * Math.PI) / 180));

  return {
    lat: base.lat + latOffset,
    lng: base.lng + lngOffset,
  };
}

/**
 * Formats distance for display in Bangla or English
 */
export function formatDistanceKm(distanceKm: number, lang: 'bn' | 'en'): string {
  if (lang === 'bn') {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const numStr = distanceKm.toFixed(1);
    const bnNum = numStr.replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
    return `${bnNum} কিমি দূরে`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}
