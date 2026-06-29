import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const prices = {
    U91: process.env.FUEL_PRICE_91 ?? null,
    U95: process.env.FUEL_PRICE_95 ?? null,
    U98: process.env.FUEL_PRICE_98 ?? null,
    Diesel: process.env.FUEL_PRICE_DIESEL ?? null,
  };

  return NextResponse.json(
    {
      station: 'LMCT+ Preston VIC',
      type: 'member',
      prices,
      updatedAt: process.env.FUEL_PRICES_UPDATED ?? null,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
