import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached, isStale, nextSyncTime } from '@/lib/cache';
import { fetchPrices } from '@/lib/petrolspy';
import type { PricesResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fuelFilter = searchParams.get('fuel'); // e.g. ?fuel=U91
  const sort = searchParams.get('sort') ?? 'name'; // name | price

  let cached = await getCached();

  // If cache is stale, try a fresh fetch (reactive refresh for non-Pro Vercel plans)
  if (!cached || isStale(cached.syncedAt)) {
    try {
      cached = await fetchPrices();
      await setCached(cached);
    } catch {
      // Return stale data if available, with stale flag
    }
  }

  if (!cached) {
    return NextResponse.json(
      { error: 'No price data available yet. Sync has not run.' },
      { status: 503 },
    );
  }

  let stations = cached.stations;

  // Filter by fuel type
  if (fuelFilter) {
    const needle = fuelFilter.toUpperCase();
    stations = stations
      .map((s) => ({
        ...s,
        prices: s.prices.filter((p) => p.type.toUpperCase() === needle),
      }))
      .filter((s) => s.prices.length > 0);
  }

  // Sort
  if (sort === 'price' && fuelFilter) {
    stations = [...stations].sort((a, b) => {
      const pa = a.prices[0]?.price ?? Infinity;
      const pb = b.prices[0]?.price ?? Infinity;
      return pa - pb;
    });
  } else {
    stations = [...stations].sort((a, b) => a.name.localeCompare(b.name));
  }

  const response: PricesResponse = {
    stations,
    lastSync: cached.syncedAt,
    nextSync: nextSyncTime(cached.syncedAt),
    stale: isStale(cached.syncedAt),
    location: cached.location,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
