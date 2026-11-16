import React, { useEffect } from 'react';

export interface JsonLdProps {
  data: Record<string, unknown>;
  id?: string;
}

/**
 * Reusable Schema.org JSON-LD component for SEO, GEO (ChatGPT Search, Perplexity, Google AI Overviews),
 * and AEO (Featured Snippets, People Also Ask, HowTo, FAQPage, BreadcrumbList).
 * Syncs with the head <script id="vidnex-jsonld-schema" type="application/ld+json"> injected at build time
 * so there is never a duplicate schema tag in the DOM.
 */
export const JsonLd: React.FC<JsonLdProps> = ({
  data,
  id = 'vidnex-jsonld-schema',
}) => {
  const serialized = JSON.stringify(data);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let scriptEl = document.getElementById(id) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = id;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = serialized;
  }, [id, serialized]);

  return null;
};

export default JsonLd;
