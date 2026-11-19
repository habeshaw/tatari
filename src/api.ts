import { isSupabaseConfigured, supabase } from './lib/supabase';

const TOKEN_KEY = 'tatari_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

async function trySupabasePublicFallback<T>(path: string): Promise<T | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  if (path === '/api/categories') {
    const { data, error } = await supabase
      .from('job_categories')
      .select('id, name, slug')
      .order('id', { ascending: true });
    if (!error && data) {
      return { categories: data.map((c) => ({ ...c, active_count: 0 })) } as T;
    }
  }

  if (path === '/api/sources/public') {
    const { data, error } = await supabase
      .from('job_sources')
      .select('id, source_name, website_url')
      .eq('status', 'active')
      .order('source_name', { ascending: true });
    if (!error && data) {
      return { sources: data.map((s) => ({ ...s, active_count: 0 })) } as T;
    }
  }

  if (path.startsWith('/api/jobs?')) {
    const queryStr = path.split('?')[1] || '';
    const params = new URLSearchParams(queryStr);
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(params.get('limit') || 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let qBuilder = supabase
      .from('jobs')
      .select(
        '*, job_categories(name, slug), job_sources(source_name, website_url)',
        { count: 'exact' }
      )
      .in('status', ['active', 'approved']);

    const q = params.get('q')?.trim();
    if (q) {
      qBuilder = qBuilder.or(`title.ilike.%${q}%,company_name.ilike.%${q}%,description.ilike.%${q}%`);
    }
    const loc = params.get('location')?.trim();
    if (loc) qBuilder = qBuilder.ilike('location', `%${loc}%`);
    const origin = params.get('job_origin')?.trim();
    if (origin === 'external' || origin === 'tatari') qBuilder = qBuilder.eq('job_origin', origin);
    const catId = params.get('category_id');
    if (catId) qBuilder = qBuilder.eq('category_id', Number(catId));
    const srcId = params.get('source_id');
    if (srcId) qBuilder = qBuilder.eq('source_id', Number(srcId));
    const empType = params.get('employment_type');
    if (empType) qBuilder = qBuilder.eq('employment_type', empType);

    let { data, count, error } = await qBuilder
      .order('is_featured', { ascending: false })
      .order('published_at', { ascending: false })
      .range(from, to);

    // Retry flat select('*') if PostgREST relationship join isn't linked yet
    if (error) {
      const flatRes = await supabase
        .from('jobs')
        .select('*', { count: 'exact' })
        .in('status', ['active', 'approved'])
        .range(from, to);
      data = flatRes.data;
      count = flatRes.count;
      error = flatRes.error;
    }

    if (!error && data) {
      const normalized = data.map((row: Record<string, unknown>) => {
        const cat = row.job_categories as { name?: string; slug?: string } | null;
        const src = row.job_sources as { source_name?: string; website_url?: string } | null;
        return {
          ...row,
          job_origin: row.job_origin === 'external' ? 'external' : 'tatari',
          published_at: row.published_at || row.created_at || new Date().toISOString(),
          salary_currency: row.salary_currency || 'ETB',
          category_name: cat?.name || 'Other',
          category_slug: cat?.slug || 'other',
          source_name: src?.source_name || null,
          source_website_url: src?.website_url || null,
          is_featured: row.is_featured ? 1 : 0,
          expiring_soon: false,
        };
      });
      const total = count ?? normalized.length;
      return {
        jobs: normalized,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      } as T;
    }
  }

  if (path.startsWith('/api/jobs/') && !path.includes('manage')) {
    const slug = decodeURIComponent(path.replace('/api/jobs/', '').split('?')[0]);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (!error && data) {
      return {
        job: {
          ...data,
          job_origin: data.job_origin === 'external' ? 'external' : 'tatari',
          published_at: data.published_at || data.created_at || new Date().toISOString(),
          salary_currency: data.salary_currency || 'ETB',
          category_name: 'Other',
          category_slug: 'other',
          source_name: null,
          source_website_url: null,
          is_featured: data.is_featured ? 1 : 0,
        },
        jsonLd: null,
      } as T;
    }
  }

  if (path === '/api/store/products') {
    const { data, error } = await supabase
      .from('digital_products')
      .select('*')
      .in('status', ['active', 'approved'])
      .order('id', { ascending: true });
    if (!error && data) {
      return { products: data } as T;
    }
  }

  return null;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['x-tatari-token'] = token;
  }

  const res = await fetch(path, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';

  // When hosted statically on Vercel without an Express server, /api/* rewrites or 404s return HTML/404.
  if ((!res.ok || !contentType.includes('application/json')) && (!options.method || options.method === 'GET')) {
    const fallback = await trySupabasePublicFallback<T>(path);
    if (fallback !== null) {
      return fallback;
    }
  }

  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}
