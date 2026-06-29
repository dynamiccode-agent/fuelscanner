# Fuel Scanner — Product Context

## Product Purpose
Live fuel price monitoring service for Preston VIC and surrounds. Polls petrolspy.com.au every 10 minutes, caches results in Upstash Redis, and exposes a REST API for downstream sites to consume. The dashboard is a status/monitoring view — primarily used by developers and operators, not end consumers.

## Users
- Developer / operator checking API health and live price data
- Secondary: end consumer checking cheapest fuel before driving

## Brand
- Name: Fuel Scanner
- Tone: Precise, utilitarian, no-nonsense. Data first. Like a Bloomberg terminal, not a consumer app.
- Anti-references: Bright consumer apps, gradient-heavy SaaS dashboards, anything with purple/blue gradient on white

## Strategic Principles
- Data density over decoration
- Every element earns its place
- Operators trust the service more when the UI looks reliable, not flashy

## Register
product

## Key Surfaces
- Dashboard (`/`) — live prices, stats, station grid
- API endpoints — consumed programmatically by external sites
