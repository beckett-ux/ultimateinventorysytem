export const runtime = 'nodejs';

let cache = { at: 0, vendors: [] };
const TTL_MS = 10 * 60 * 1000;

const norm = (s) => String(s || '').trim().toLowerCase();

function bestMatch(vendors, q) {
  const nq = norm(q);
  if (!nq) return null;
  for (const v of vendors) if (norm(v) === nq) return v; // exact
  for (const v of vendors) if (norm(v).includes(nq)) return v; // contains
  const token = nq.split(/\s+/).filter(Boolean).pop(); // last token
  if (token) for (const v of vendors) if (norm(v).split(/\s+/).includes(token)) return v;
  return null;
}

async function fetchVendors() {
  const url = process.env.VENDOR_SHEETS_WEBAPP_URL;
  const key = process.env.VENDOR_SHEETS_WEBAPP_KEY;
  if (!url || !key) throw new Error('Missing VENDOR_SHEETS_WEBAPP_URL or VENDOR_SHEETS_WEBAPP_KEY');

  const res = await fetch(`${url}?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Sheets webapp error: ${res.status || 0} ${data.error || ''}`.trim());

  return Array.isArray(data.vendors) ? data.vendors : [];
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  const now = Date.now();
  if (!cache.vendors.length || now - cache.at > TTL_MS) {
    cache.vendors = await fetchVendors();
    cache.at = now;
  }

  return Response.json({
    match: bestMatch(cache.vendors, q),
    vendors: q ? [] : cache.vendors.slice(0, 50),
  });
}
