import { NextResponse } from 'next/server';
import { getMeta, isStale } from '@/lib/cache';
import type { HealthResponse } from '@/lib/types';

export async function GET() {
  const meta = await getMeta();

  if (!meta) {
    const res: HealthResponse = {
      status: 'error',
      lastSync: null,
      stationCount: 0,
      message: 'No sync has run yet',
    };
    return NextResponse.json(res, { status: 503 });
  }

  const stale = isStale(meta.lastSync);
  const res: HealthResponse = {
    status: stale ? 'stale' : 'ok',
    lastSync: meta.lastSync,
    stationCount: meta.stationCount,
    message: stale
      ? `Last sync was over 15 minutes ago (${meta.lastSync})`
      : `Healthy — ${meta.stationCount} stations synced`,
  };

  return NextResponse.json(res);
}
