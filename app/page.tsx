import type { Station, FuelPrice } from '@/lib/types';
import { getCached, setCached, isStale, nextSyncTime } from '@/lib/cache';
import { fetchPrices } from '@/lib/petrolspy';

export const dynamic = 'force-dynamic';

const FUEL_LABELS: Record<string, string> = {
  E10: 'E10',
  U91: 'Unleaded 91',
  U95: 'Premium 95',
  U98: 'Premium 98',
  Diesel: 'Diesel',
  PDiesel: 'Premium Diesel',
  LPG: 'LPG',
  AdBlue: 'AdBlue',
};

async function getData() {
  let cached = await getCached();
  if (!cached || isStale(cached.syncedAt)) {
    try {
      cached = await fetchPrices();
      await setCached(cached);
    } catch {
      // return stale if available
    }
  }
  return cached;
}

function PriceChip({ price }: { price: FuelPrice }) {
  return (
    <div style={styles.chip}>
      <span style={styles.chipLabel}>{FUEL_LABELS[price.type] ?? price.type}</span>
      <span style={styles.chipPrice}>{price.price}c</span>
    </div>
  );
}

function StationCard({ station }: { station: Station }) {
  const cheapestU91 = station.prices.find((p) => p.type === 'U91');
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <p style={styles.stationName}>{station.name}</p>
          {station.address && (
            <p style={styles.stationAddress}>
              {station.address}
              {station.suburb ? `, ${station.suburb}` : ''}
            </p>
          )}
        </div>
        {cheapestU91 && (
          <div style={styles.badge}>
            <span style={styles.badgeLabel}>U91</span>
            <span style={styles.badgePrice}>{cheapestU91.price}c</span>
          </div>
        )}
      </div>
      <div style={styles.chipRow}>
        {station.prices.map((p) => (
          <PriceChip key={p.type} price={p} />
        ))}
      </div>
    </div>
  );
}

export default async function Home() {
  const data = await getData();

  const sorted = data?.stations
    ? [...data.stations].sort((a, b) => {
        const pa = a.prices.find((p) => p.type === 'U91')?.price ?? Infinity;
        const pb = b.prices.find((p) => p.type === 'U91')?.price ?? Infinity;
        return pa - pb;
      })
    : [];

  const cheapestU91 = sorted.find((s) => s.prices.some((p) => p.type === 'U91'));
  const cheapestDiesel = data?.stations
    ? [...data.stations].sort((a, b) => {
        const pa = a.prices.find((p) => p.type === 'Diesel')?.price ?? Infinity;
        const pb = b.prices.find((p) => p.type === 'Diesel')?.price ?? Infinity;
        return pa - pb;
      })[0]
    : undefined;

  const lastSync = data?.syncedAt ? new Date(data.syncedAt) : null;
  const nextSync = data ? new Date(nextSyncTime(data.syncedAt)) : null;
  const stale = data ? isStale(data.syncedAt) : true;

  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Fuel Scanner</h1>
          <p style={styles.subtitle}>Live fuel prices — Preston VIC &amp; surrounds</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ ...styles.dot, background: data && !stale ? '#22c55e' : '#ef4444' }} />
          <span style={styles.statusText}>
            {data && !stale ? 'Live' : data ? 'Stale' : 'No data'}
          </span>
        </div>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Stations</span>
          <span style={styles.statValue}>{data?.stations.length ?? '—'}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Last sync</span>
          <span style={styles.statValue}>
            {lastSync ? lastSync.toLocaleTimeString('en-AU') : '—'}
          </span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Next sync</span>
          <span style={styles.statValue}>
            {nextSync ? nextSync.toLocaleTimeString('en-AU') : '—'}
          </span>
        </div>
        {cheapestU91 && (
          <div style={styles.stat}>
            <span style={styles.statLabel}>Cheapest U91</span>
            <span style={{ ...styles.statValue, color: '#22c55e' }}>
              {cheapestU91.prices.find((p) => p.type === 'U91')?.price}c — {cheapestU91.name}
            </span>
          </div>
        )}
        {cheapestDiesel?.prices.find((p) => p.type === 'Diesel') && (
          <div style={styles.stat}>
            <span style={styles.statLabel}>Cheapest Diesel</span>
            <span style={{ ...styles.statValue, color: '#22c55e' }}>
              {cheapestDiesel.prices.find((p) => p.type === 'Diesel')?.price}c — {cheapestDiesel.name}
            </span>
          </div>
        )}
      </div>

      <div style={styles.apiBox}>
        <p style={styles.apiTitle}>API Endpoints</p>
        <div style={styles.apiGrid}>
          {[
            ['GET /api/prices', 'All stations + prices (JSON)'],
            ['GET /api/prices?fuel=U91&sort=price', 'Filter by fuel, sorted cheapest first'],
            ['GET /api/prices?fuel=Diesel', 'Diesel prices only'],
            ['GET /api/health', 'Service status + last sync'],
          ].map(([ep, desc]) => (
            <div key={ep} style={styles.apiRow}>
              <code style={styles.code}>{ep}</code>
              <span style={styles.apiDesc}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {!data && (
        <div style={styles.empty}>
          No price data yet — waiting on first sync. Check{' '}
          <code>/api/health</code> for status.
        </div>
      )}

      <div style={styles.grid}>
        {sorted.map((station) => (
          <StationCard key={station.id} station={station} />
        ))}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: '50%' },
  statusText: { fontSize: 13, color: '#aaa' },
  statsRow: { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 },
  stat: { background: '#141414', border: '1px solid #222', borderRadius: 10, padding: '12px 16px', minWidth: 140 },
  statLabel: { display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', marginBottom: 4 },
  statValue: { display: 'block', fontSize: 14, fontWeight: 600, color: '#f5f5f5' },
  apiBox: { background: '#111', border: '1px solid #222', borderRadius: 10, padding: '16px 20px', marginBottom: 32 },
  apiTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', marginBottom: 12 },
  apiGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  apiRow: { display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' },
  code: { fontFamily: 'monospace', fontSize: 13, color: '#7dd3fc', background: '#0c1a24', padding: '2px 8px', borderRadius: 4 },
  apiDesc: { fontSize: 13, color: '#666' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 },
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: '16px 20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  stationName: { fontWeight: 600, fontSize: 15, lineHeight: 1.3 },
  stationAddress: { fontSize: 12, color: '#555', marginTop: 2 },
  badge: { background: '#0f1a0f', border: '1px solid #1a3d1a', borderRadius: 8, padding: '4px 10px', textAlign: 'center', flexShrink: 0 },
  badgeLabel: { display: 'block', fontSize: 10, color: '#4ade80', letterSpacing: '0.05em' },
  badgePrice: { display: 'block', fontSize: 16, fontWeight: 700, color: '#22c55e' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, padding: '3px 8px', display: 'flex', gap: 6, alignItems: 'center' },
  chipLabel: { fontSize: 11, color: '#777' },
  chipPrice: { fontSize: 12, fontWeight: 600, color: '#e5e5e5' },
  empty: { textAlign: 'center', padding: '60px 0', color: '#444', fontSize: 14 },
};
