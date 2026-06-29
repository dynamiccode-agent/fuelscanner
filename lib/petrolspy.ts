import type { Station, FuelPrice, CacheData } from './types';

const BASE = 'https://petrolspy.com.au/webservice-1';

const DEFAULT_LAT = parseFloat(process.env.DEFAULT_LAT ?? '-37.74083588803176');
const DEFAULT_LNG = parseFloat(process.env.DEFAULT_LNG ?? '145.00965855160715');
const DEFAULT_RADIUS = parseFloat(process.env.DEFAULT_RADIUS ?? '5');

const HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-AU,en;q=0.9',
  Referer: 'https://petrolspy.com.au/',
  Origin: 'https://petrolspy.com.au',
};

// Actual fuel type codes from petrolspy API → normalised labels
const FUEL_TYPE_MAP: Record<string, string> = {
  U91: 'U91',
  E10: 'E10',
  U95: 'U95',
  U98: 'U98',
  DIESEL: 'Diesel',
  PremDSL: 'PDiesel',
  TruckDSL: 'TruckDiesel',
  LPG: 'LPG',
  AdBlue: 'AdBlue',
  BIODIESEL: 'Biodiesel',
  E85: 'E85',
};

function radiusToBbox(lat: number, lng: number, radiusKm: number) {
  // 1° lat ≈ 111km; 1° lng ≈ 111km * cos(lat)
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    neLat: lat + dLat,
    neLng: lng + dLng,
    swLat: lat - dLat,
    swLng: lng - dLng,
  };
}

interface RawPrice {
  type: string;
  amount: number;
  updated: number; // unix ms
  relevant?: boolean;
}

interface RawStation {
  id: string;
  name: string;
  brand: string;
  state: string;
  suburb: string;
  address: string;
  postCode?: string;
  location: { x: number; y: number }; // x=lng, y=lat
  prices: Record<string, RawPrice>;
}

function parseStation(raw: RawStation): Station {
  const prices: FuelPrice[] = Object.values(raw.prices)
    .filter((p) => p.amount > 0)
    .map((p) => ({
      type: FUEL_TYPE_MAP[p.type] ?? p.type,
      price: p.amount,
      updated: new Date(p.updated).toISOString(),
    }))
    .sort((a, b) => {
      const order = ['U91', 'E10', 'U95', 'U98', 'Diesel', 'PDiesel', 'LPG', 'AdBlue'];
      return (order.indexOf(a.type) ?? 99) - (order.indexOf(b.type) ?? 99);
    });

  return {
    id: raw.id,
    name: raw.name,
    brand: raw.brand ?? '',
    address: raw.address ?? '',
    suburb: raw.suburb ?? '',
    state: raw.state ?? 'VIC',
    postcode: raw.postCode,
    lat: raw.location.y,
    lng: raw.location.x,
    prices,
  };
}

export async function fetchPrices(
  lat = DEFAULT_LAT,
  lng = DEFAULT_LNG,
  radius = DEFAULT_RADIUS,
): Promise<CacheData> {
  const { neLat, neLng, swLat, swLng } = radiusToBbox(lat, lng, radius);
  const ts = Date.now();
  const url = `${BASE}/station/box?neLat=${neLat}&neLng=${neLng}&swLat=${swLat}&swLng=${swLng}&ts=${ts}`;

  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`PetrolSpy returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    header: { size: number };
    message: { list: RawStation[] };
  };

  const raw = data?.message?.list;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('PetrolSpy returned empty station list');
  }

  return {
    stations: raw.map(parseStation),
    syncedAt: new Date().toISOString(),
    source: 'api',
    location: { lat, lng, radius },
  };
}
