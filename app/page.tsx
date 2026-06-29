import type { Station, FuelPrice } from '@/lib/types';
import { getCached, setCached, isStale, nextSyncTime } from '@/lib/cache';
import { fetchPrices } from '@/lib/petrolspy';

export const dynamic = 'force-dynamic';

const FUEL_PRIORITY = ['U91', 'E10', 'U95', 'U98', 'Diesel', 'PDiesel', 'LPG', 'E85', 'AdBlue'];

const FUEL_SHORT: Record<string, string> = {
  U91: 'U91', E10: 'E10', U95: 'U95', U98: 'U98',
  Diesel: 'DSL', PDiesel: 'P·DSL', LPG: 'LPG',
  AdBlue: 'AdBlue', E85: 'E85', Biodiesel: 'BIO', TruckDiesel: 'T·DSL',
};

function getLmctPrices() {
  return {
    U91: process.env.FUEL_PRICE_91 ?? null,
    U95: process.env.FUEL_PRICE_95 ?? null,
    U98: process.env.FUEL_PRICE_98 ?? null,
    Diesel: process.env.FUEL_PRICE_DIESEL ?? null,
    updatedAt: process.env.FUEL_PRICES_UPDATED ?? null,
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Australia/Melbourne',
  });
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

async function getData() {
  let cached = await getCached();
  if (!cached || isStale(cached.syncedAt)) {
    try { cached = await fetchPrices(); await setCached(cached); } catch { /* use stale */ }
  }
  return cached;
}

function getPrice(prices: FuelPrice[], type: string) {
  return prices.find(p => p.type === type);
}

function StationCard({
  station, cheapestId,
}: { station: Station; cheapestId: string | undefined }) {
  const isBest = station.id === cheapestId;
  const u91 = getPrice(station.prices, 'U91');
  const fuels = FUEL_PRIORITY.filter(t => station.prices.some(p => p.type === t));

  return (
    <article
      className={`station-card${isBest ? ' station-card--cheapest' : ''}`}
      role="listitem"
      aria-label={`${station.name}${isBest ? ', cheapest U91' : ''}`}
    >
      <div className="card-header">
        <div className="card-meta">
          <p className="card-name">{station.name}</p>
          <p className="card-address">
            {[station.address, station.suburb].filter(Boolean).join(' · ')}
          </p>
        </div>
        {u91 && (
          <div className={`u91-badge${isBest ? ' u91-badge--best' : ''}`}>
            <span className="u91-badge__type">U91</span>
            <span className="u91-badge__price">{u91.price}¢</span>
          </div>
        )}
      </div>

      {fuels.length > 0 && (
        <div className="fuel-prices">
          {fuels.map(type => {
            const p = getPrice(station.prices, type)!;
            const isPrimary = type === 'U91';
            return (
              <div key={type} className={`fuel-cell${isPrimary ? ' fuel-cell--primary' : ''}`}>
                <span className="fuel-cell__type">{FUEL_SHORT[type] ?? type}</span>
                <span className="fuel-cell__price">{p.price}</span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

export default async function Home() {
  const data = await getData();
  const lmctPrices = getLmctPrices();

  const byU91 = data?.stations
    ? [...data.stations].sort((a, b) => {
        const pa = a.prices.find(p => p.type === 'U91')?.price ?? Infinity;
        const pb = b.prices.find(p => p.type === 'U91')?.price ?? Infinity;
        return pa - pb;
      })
    : [];

  const cheapestU91Station = byU91.find(s => s.prices.some(p => p.type === 'U91'));
  const cheapestU91Price = cheapestU91Station?.prices.find(p => p.type === 'U91')?.price;

  const cheapestDieselStation = data?.stations
    ? [...data.stations]
        .sort((a, b) => {
          const pa = a.prices.find(p => p.type === 'Diesel')?.price ?? Infinity;
          const pb = b.prices.find(p => p.type === 'Diesel')?.price ?? Infinity;
          return pa - pb;
        })
        .find(s => s.prices.some(p => p.type === 'Diesel'))
    : undefined;
  const cheapestDieselPrice = cheapestDieselStation?.prices.find(p => p.type === 'Diesel')?.price;

  const syncedAt = data?.syncedAt ?? null;
  const stale = data ? isStale(data.syncedAt) : true;
  const live = data && !stale;
  const pillClass = live ? 'live-pill--live' : data ? 'live-pill--stale' : 'live-pill--none';

  return (
    <main className="main" id="main-content">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* ── Header ── */}
      <header className="site-header" role="banner">
        <div className="site-header__left">
          <div className="wordmark">
            <span className="wordmark__fuel">FUEL</span>
            <span className="wordmark__div">/</span>
            <span className="wordmark__scanner">SCANNER</span>
          </div>
          <p className="site-header__sub">
            Preston &amp; surrounds · 5 km radius · VIC
          </p>

          {(lmctPrices.U91 || lmctPrices.U95 || lmctPrices.U98 || lmctPrices.Diesel) && (
            <div className="member-prices" aria-label="LMCT+ member prices">
              <span className="member-prices__label">Member</span>
              {([
                ['U91', lmctPrices.U91],
                ['U95', lmctPrices.U95],
                ['U98', lmctPrices.U98],
                ['DSL', lmctPrices.Diesel],
              ] as [string, string | null][]).filter(([, v]) => v !== null).map(([label, price]) => (
                <div key={label} className="member-price-item">
                  <span className="member-price-item__type">{label}</span>
                  <span className="member-price-item__price">{price}¢</span>
                </div>
              ))}
              {lmctPrices.updatedAt && (
                <span className="member-prices__updated">
                  upd {formatTime(lmctPrices.updatedAt)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="site-header__right">
          <span className={`live-pill ${pillClass}`}>
            <span className="live-pill__dot" />
            <span className="live-pill__text">
              {live ? 'Live' : data ? 'Stale' : 'No data'}
            </span>
          </span>
          {syncedAt && (
            <span className="header-sync">synced {formatTime(syncedAt)}</span>
          )}
        </div>
      </header>

      {/* ── Stats bar ── */}
      <section aria-label="Price summary" className="stats-bar">
        <div className="stat-panel">
          <span className="stat-label">Stations</span>
          <span className="stat-value">{data?.stations.length ?? '—'}</span>
        </div>

        {cheapestU91Price !== undefined && (
          <div className="stat-panel stat-panel--accent">
            <span className="stat-label">Cheapest U91</span>
            <span className="stat-value stat-value--amber">{cheapestU91Price}¢</span>
            {cheapestU91Station && (
              <span className="stat-sub">{cheapestU91Station.name}</span>
            )}
          </div>
        )}

        {cheapestDieselPrice !== undefined && (
          <div className="stat-panel stat-panel--accent">
            <span className="stat-label">Cheapest Diesel</span>
            <span className="stat-value stat-value--amber">{cheapestDieselPrice}¢</span>
            {cheapestDieselStation && (
              <span className="stat-sub">{cheapestDieselStation.name}</span>
            )}
          </div>
        )}

        <div className="stat-panel">
          <span className="stat-label">Last sync</span>
          <span className="stat-value">{syncedAt ? formatTime(syncedAt) : '—'}</span>
          {syncedAt && <span className="stat-sub">{timeAgo(syncedAt)}</span>}
        </div>

        <div className="stat-panel">
          <span className="stat-label">Next sync</span>
          <span className="stat-value">
            {syncedAt ? formatTime(nextSyncTime(syncedAt)) : '—'}
          </span>
        </div>
      </section>

      {/* ── Station grid ── */}
      {!data ? (
        <div className="empty-state">
          <p>No price data yet — waiting on first sync</p>
          <code>GET /api/sync</code>
        </div>
      ) : (
        <div className="station-grid" role="list" aria-label="Fuel stations sorted by U91 price">
          {byU91.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              cheapestId={cheapestU91Station?.id}
            />
          ))}
        </div>
      )}

      {/* ── API reference ── */}
      <aside className="api-ref">
        <div className="api-ref__head">
          <p className="api-ref__title">API Endpoints</p>
        </div>
        <div className="api-ref__list">
          {([
            ['GET /api/prices', 'All stations + prices (JSON)'],
            ['GET /api/prices?fuel=U91&sort=price', 'Filter by fuel type, sorted cheapest first'],
            ['GET /api/prices?fuel=Diesel', 'Diesel prices only'],
            ['GET /api/health', 'Service status + last sync time'],
            ['GET /api/sync', 'Trigger manual sync (Bearer token required)'],
            ['GET /api/lmct-prices', 'LMCT+ member prices (U91, U95, U98, Diesel)'],
          ] as [string, string][]).map(([ep, desc]) => (
            <div key={ep} className="api-ref__row">
              <code className="api-ref__code">{ep}</code>
              <span className="api-ref__desc">{desc}</span>
            </div>
          ))}
        </div>
      </aside>

    </main>
  );
}
