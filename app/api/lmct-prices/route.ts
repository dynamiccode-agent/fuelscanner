import { NextResponse } from 'next/server';
import { getCached, setCached, isStale } from '@/lib/cache';
import { fetchPrices } from '@/lib/petrolspy';

export const dynamic = 'force-dynamic';

const LMCT_STATION_ID = process.env.LMCT_STATION_ID ?? '53bf7688e4b06aebec7f0113';

export async function GET() {
  let cached = await getCached();

  if (!cached || isStale(cached.syncedAt)) {
    try {
      cached = await fetchPrices();
      await setCached(cached);
    } catch {
      // use stale if available
    }
  }

  if (!cached) {
    return NextResponse.json(
      { error: 'No price data available yet.' },
      { status: 503 },
    );
  }

  const station = cached.stations.find(s => s.id === LMCT_STATION_ID);

  if (!station) {
    return NextResponse.json(
      { error: 'LMCT+ station not found in current data.' },
      { status: 404 },
    );
  }

  const get = (type: string) => {
    const p = station.prices.find(p => p.type === type);
    return p ? String(p.price) : null;
  };

  return NextResponse.json(
    {
      station: station.name,
      address: `${station.address}, ${station.suburb} ${station.state}`,
      type: 'member',
      prices: {
        ulp91:  get('U91'),
        ulp95:  get('U95'),
        ulp98:  get('U98'),
        diesel: get('Diesel'),
      },
      syncedAt: cached.syncedAt,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
