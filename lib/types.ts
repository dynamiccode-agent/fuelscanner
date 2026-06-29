export type FuelType =
  | 'E10'
  | 'U91'
  | 'U95'
  | 'U98'
  | 'Diesel'
  | 'PDiesel'
  | 'LPG'
  | 'AdBlue'
  | string;

export interface FuelPrice {
  type: FuelType;
  price: number; // cents per litre, e.g. 149.5
  updated: string; // ISO timestamp
}

export interface Station {
  id: string;
  name: string;
  brand: string;
  address: string;
  suburb: string;
  state: string;
  postcode?: string;
  lat: number;
  lng: number;
  prices: FuelPrice[];
  distanceKm?: number;
}

export interface CacheData {
  stations: Station[];
  syncedAt: string;
  source: 'api' | 'mock';
  location: { lat: number; lng: number; radius: number };
}

export interface SyncMeta {
  lastSync: string;
  stationCount: number;
  source: string;
}

export interface PricesResponse {
  stations: Station[];
  lastSync: string | null;
  nextSync: string | null;
  stale: boolean;
  location: { lat: number; lng: number; radius: number };
}

export interface HealthResponse {
  status: 'ok' | 'stale' | 'error';
  lastSync: string | null;
  stationCount: number;
  message: string;
}
