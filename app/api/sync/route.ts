import { NextRequest, NextResponse } from 'next/server';
import { fetchPrices } from '@/lib/petrolspy';
import { setCached } from '@/lib/cache';

// Vercel cron calls this with Authorization: Bearer <CRON_SECRET>
// Manual trigger also allowed when the same secret is passed
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lat = parseFloat(request.nextUrl.searchParams.get('lat') ?? process.env.DEFAULT_LAT ?? '-37.74083588803176');
  const lng = parseFloat(request.nextUrl.searchParams.get('lng') ?? process.env.DEFAULT_LNG ?? '145.00965855160715');
  const radius = parseFloat(request.nextUrl.searchParams.get('radius') ?? process.env.DEFAULT_RADIUS ?? '5');

  try {
    const data = await fetchPrices(lat, lng, radius);
    await setCached(data);

    return NextResponse.json({
      ok: true,
      syncedAt: data.syncedAt,
      stationCount: data.stations.length,
      source: data.source,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fuelscanner sync]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
