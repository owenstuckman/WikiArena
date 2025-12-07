import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { GROK_SCRAPER_URL } from '$env/static/private';

const DEFAULT_SCRAPER =
  'https://infoareaselenium.onrender.com:8080/scrape/grokipedia';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const topic = url.searchParams.get('topic');
  const debug = url.searchParams.get('debug');

  if (!topic) {
    return json({ error: 'Missing topic parameter' }, { status: 400 });
  }

  const base = GROK_SCRAPER_URL || DEFAULT_SCRAPER;

  const scraperUrl = new URL(base);
  scraperUrl.searchParams.set('topic', topic);
  if (debug === '1') scraperUrl.searchParams.set('debug', '1');

  try {
    const res = await fetch(scraperUrl.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return json(
        { error: `Scraper service error: ${res.status}`, details: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    return json(data);
  } catch (err) {
    return json(
      { error: 'Failed to reach scraper service', details: String(err) },
      { status: 502 }
    );
  }
};
