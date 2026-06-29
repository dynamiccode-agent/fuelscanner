import type { Station, FuelPrice, CacheData } from './types';

const DEFAULT_LAT = parseFloat(process.env.DEFAULT_LAT ?? '-37.74083588803176');
const DEFAULT_LNG = parseFloat(process.env.DEFAULT_LNG ?? '145.00965855160715');
const DEFAULT_RADIUS = parseFloat(process.env.DEFAULT_RADIUS ?? '5');

// Mimic browser headers so petrolspy doesn't block the request
const BROWSER_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-AU,en;q=0.9',
  Referer: 'https://petrolspy.com.au/',
  Origin: 'https://petrolspy.com.au',
};

// PetrolSpy fuel type codes → normalised labels
const FUEL_TYPE_MAP: Record<string, string> = {
  E: 'U91',
  U: 'U91',
  E10: 'E10',
  U91: 'U91',
  P95: 'U95',
  U95: 'U95',
  P98: 'U98',
  U98: 'U98',
  DL: 'Diesel',
  D: 'Diesel',
  Diesel: 'Diesel',
  PDL: 'PDiesel',
  PD: 'PDiesel',
  LP: 'LPG',
  LPG: 'LPG',
  AB: 'AdBlue',
};

function normaliseFuelType(raw: string): string {
  return FUEL_TYPE_MAP[raw] ?? raw;
}

function parsePrices(raw: unknown): FuelPrice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: Record<string, unknown>) => ({
      type: normaliseFuelType(String(p.type ?? p.Type ?? p.fuelType ?? p.name ?? '')),
      price: parseFloat(String(p.price ?? p.Price ?? p.amount ?? 0)),
      updated: String(p.updated ?? p.Updated ?? p.timestamp ?? new Date().toISOString()),
    }))
    .filter((p) => p.price > 0);
}

const KNOWN_BRANDS = [
  'BP', 'Shell', 'Caltex', 'Ampol', 'United', 'Liberty', 'Mobil',
  '7-Eleven', 'Metro', 'Puma', 'Reddy', 'EG', 'Pearl', 'LMCT+',
];

function extractBrand(name: string): string {
  const lower = name?.toLowerCase() ?? '';
  for (const b of KNOWN_BRANDS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  return '';
}

function parseStation(raw: Record<string, unknown>): Station {
  const name = String(raw.name ?? raw.Name ?? raw.stationName ?? '');
  return {
    id: String(raw.id ?? raw.Id ?? raw.stationId ?? Math.random()),
    name,
    brand: String(raw.brand ?? raw.Brand ?? extractBrand(name) ?? ''),
    address: String(raw.address ?? raw.Address ?? raw.street ?? ''),
    suburb: String(raw.suburb ?? raw.Suburb ?? ''),
    state: String(raw.state ?? raw.State ?? 'VIC'),
    postcode: raw.postcode ? String(raw.postcode) : undefined,
    lat: parseFloat(String(raw.lat ?? raw.latitude ?? raw.Lat ?? 0)),
    lng: parseFloat(String(raw.lng ?? raw.longitude ?? raw.Lng ?? 0)),
    prices: parsePrices(raw.prices ?? raw.Prices ?? raw.fuelTypes ?? raw.fuelPrices ?? []),
  };
}

async function tryEndpoint(url: string): Promise<Station[] | null> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) return null;

  const data: unknown = await res.json();

  // Handle various response shapes
  const raw =
    (data as Record<string, unknown>)?.stations ??
    (data as Record<string, unknown>)?.Stations ??
    (data as Record<string, unknown>)?.result ??
    (data as Record<string, unknown>)?.data ??
    data;

  if (Array.isArray(raw) && raw.length > 0) {
    return (raw as Record<string, unknown>[]).map(parseStation);
  }

  return null;
}

export async function fetchPrices(
  lat = DEFAULT_LAT,
  lng = DEFAULT_LNG,
  radius = DEFAULT_RADIUS,
): Promise<CacheData> {
  // PetrolSpy webservice endpoint patterns — try in order
  const endpoints = [
    `https://petrolspy.com.au/webservice/1/station/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
    `https://petrolspy.com.au/webservice/1/station/box?neLat=${lat + 0.07}&neLng=${lng + 0.07}&swLat=${lat - 0.07}&swLng=${lng - 0.07}`,
  ];

  for (const url of endpoints) {
    try {
      const stations = await tryEndpoint(url);
      if (stations && stations.length > 0) {
        return {
          stations,
          syncedAt: new Date().toISOString(),
          source: 'api',
          location: { lat, lng, radius },
        };
      }
    } catch {
      // try next endpoint
    }
  }

  throw new Error(
    'PetrolSpy API unreachable — all endpoints failed. Check logs and verify the endpoint URLs are still valid.',
  );
}
