import Parser from 'rss-parser';
import { decode } from 'html-entities';

const parser = new Parser({
  customFields: {
    item: ['source']
  }
});

const languageDefaults: Record<string, { hl: string; gl: string; ceidLang: string }> = {
  any: { hl: 'en-US', gl: 'US', ceidLang: 'en' },
  en: { hl: 'en-US', gl: 'US', ceidLang: 'en' },
  id: { hl: 'id', gl: 'ID', ceidLang: 'id' },
  ja: { hl: 'ja', gl: 'JP', ceidLang: 'ja' },
  ar: { hl: 'ar', gl: 'AE', ceidLang: 'ar' },
  zh: { hl: 'zh-CN', gl: 'CN', ceidLang: 'zh-Hans' },
  fr: { hl: 'fr', gl: 'FR', ceidLang: 'fr' },
  de: { hl: 'de', gl: 'DE', ceidLang: 'de' },
  es: { hl: 'es', gl: 'ES', ceidLang: 'es' },
  ko: { hl: 'ko', gl: 'KR', ceidLang: 'ko' },
};

const supportedCountries = new Set(['AE', 'CN', 'DE', 'ES', 'FR', 'ID', 'JP', 'KR', 'US']);

function getGoogleNewsLocale(lang = 'any', country = 'any') {
  const locale = languageDefaults[lang] || languageDefaults.any;
  const gl = country !== 'any' && supportedCountries.has(country.toUpperCase())
    ? country.toUpperCase()
    : locale.gl;

  return `hl=${locale.hl}&gl=${gl}&ceid=${gl}:${locale.ceidLang}`;
}

export async function getNewsOnServer(q: string, lang = 'any', country = 'any') {
  const geoParams = getGoogleNewsLocale(lang, country);
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${geoParams}`;

  const feed = await parser.parseURL(rssUrl);

  const articles = feed.items.slice(0, 50).map((item, index) => {
    const fullTitle = decode(item.title || '');
    const title = fullTitle.includes(' - ') ? fullTitle.split(' - ').slice(0, -1).join(' - ') : fullTitle;
    
    let description = decode(item.contentSnippet || item.content || '');
    description = description.replace(/<[^>]+>/g, '').trim();

    // Remove redundant title and source from the description
    // Google News often puts "Title - Source" at the start of the content snippet
    if (description.startsWith(fullTitle)) {
      description = description.substring(fullTitle.length).trim();
    } else if (description.startsWith(title)) {
      description = description.substring(title.length).trim();
    }

    // Clean up leading punctuation that might remain after removing the title (e.g. " - " or ": ")
    description = description.replace(/^[\s\-\:\u00A0]+/, '').trim();

    let image: string | null = null;
    if (item.content) {
      const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch) image = imgMatch[1];
    }

    // Extract source name correctly
    let sourceName = 'Google Intelligence';
    if (typeof item.source === 'string') {
      sourceName = item.source;
    } else if (fullTitle.includes(' - ')) {
      const parts = fullTitle.split(' - ');
      sourceName = parts.pop() || sourceName;
    }

    // If description is identical to sourceName, it's redundant
    if (description === sourceName) {
      description = '';
    }

    return {
      id: item.guid || `${Date.now()}-${index}`,
      title: title,
      description: description,
      url: item.link || '',
      image: image,
      source: sourceName,
      publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
    };
  });

  articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return articles;
}
