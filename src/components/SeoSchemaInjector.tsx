import React, { useEffect } from 'react';
import { SeoToolConfig } from '../data/seoToolsConfig';
import {
  LanguageCode,
  SUPPORTED_LANGUAGES,
} from '../i18n/translations';

interface SeoSchemaInjectorProps {
  tool: SeoToolConfig;
  language: LanguageCode;
}

export const SeoSchemaInjector: React.FC<SeoSchemaInjectorProps> = ({
  tool,
  language,
}) => {
  useEffect(() => {
    // 1. Update Document Title & Meta Description
    document.title = tool.metaTitle;

    let metaDesc = document.querySelector(
      'meta[name="description"]'
    ) as HTMLMetaElement | null;
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = tool.metaDescription;

    // 2. Inject / Update <link rel="canonical" href={canonicalUrl} /> & hreflang Tags
    const baseUrl = `https://vidnex.space${tool.path}`;
    const canonicalUrl =
      language === 'en' ? baseUrl : `${baseUrl}?lang=${language}`;

    let canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    // Remove previous hreflang links managed by VIDNEX
    document
      .querySelectorAll('link[data-vidnex-hreflang="true"]')
      .forEach((node) => node.remove());

    SUPPORTED_LANGUAGES.forEach((langOpt) => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = langOpt.code;
      link.href =
        langOpt.code === 'en' ? baseUrl : `${baseUrl}?lang=${langOpt.code}`;
      link.setAttribute('data-vidnex-hreflang', 'true');
      document.head.appendChild(link);
    });

    // Add x-default hreflang tag
    const xDefaultLink = document.createElement('link');
    xDefaultLink.rel = 'alternate';
    xDefaultLink.hreflang = 'x-default';
    xDefaultLink.href = baseUrl;
    xDefaultLink.setAttribute('data-vidnex-hreflang', 'true');
    document.head.appendChild(xDefaultLink);

    // 3. Build Localized Schema.org JSON-LD Graph
    const schemaGraph = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          '@id': `${canonicalUrl}#webapp`,
          name: `VIDNEX — ${tool.h1}`,
          url: canonicalUrl,
          inLanguage: language,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'All',
          description: tool.metaDescription,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        },
        {
          '@type': 'HowTo',
          '@id': `${canonicalUrl}#howto`,
          name: tool.h1,
          inLanguage: language,
          description: tool.subtitle,
          step: tool.howToSteps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.title,
            text: step.description,
          })),
        },
        {
          '@type': 'FAQPage',
          '@id': `${canonicalUrl}#faq`,
          inLanguage: language,
          mainEntity: tool.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        },
      ],
    };

    let scriptEl = document.getElementById(
      'vidnex-jsonld-schema'
    ) as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'vidnex-jsonld-schema';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(schemaGraph);
  }, [tool, language]);

  return null;
};
