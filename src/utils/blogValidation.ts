/**
 * Validation commune (API `/api/admin/blog` + build `scripts/verify-seo.mjs`)
 * et convertisseur Markdown restreint <-> `BlogContentSection[]` sans HTML brut.
 */

import type {
  BlogArticle,
  BlogContentSection,
  BlogExternalSource,
  BlogFaqItem,
  BlogInternalLink,
  BlogTocItem,
} from '../data/blogArticles.ts';

export interface ParsedMarkdownLink {
  label: string;
  href: string;
  isExternal: boolean;
  rel?: 'noopener noreferrer';
  target?: '_blank';
}

export interface RestrictedMarkdownResult {
  tableOfContents: BlogTocItem[];
  content: BlogContentSection[];
  links: ParsedMarkdownLink[];
  wordCount: number;
  hasH1: boolean;
  hasRawHtml: boolean;
  insecureExternalLinks: string[];
}

export interface BlogValidationIssue {
  code:
    | 'INVALID_SLUG_FORMAT'
    | 'SLUG_CONTAINS_YEAR'
    | 'DUPLICATE_SLUG_IN_LOCALE'
    | 'MISSING_TITLE'
    | 'META_TITLE_EMPTY'
    | 'META_TITLE_TOO_LONG'
    | 'META_DESCRIPTION_OUT_OF_RANGE'
    | 'H1_IN_BODY'
    | 'RAW_HTML_FORBIDDEN'
    | 'INSECURE_EXTERNAL_LINK';
  field: string;
  message: string;
}

export interface BlogValidationWarning {
  code: 'SHORT_BODY_LENGTH' | 'MISSING_OR_SHORT_FAQ' | 'MISSING_SOURCES';
  field: string;
  message: string;
}

export interface BlogValidationResult {
  valid: boolean;
  errors: BlogValidationIssue[];
  warnings: BlogValidationWarning[];
  parsedMarkdown: RestrictedMarkdownResult;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEAR_IN_SLUG_REGEX = /(?:^|-)(?:19\d{2}|20\d{2})(?:-|$)/;
const RAW_HTML_TAG_REGEX =
  /<\s*\/?\s*[a-zA-Z][a-zA-Z0-9:-]*(?:\s+[^>]*)?>|<!--[\s\S]*?-->/;

/**
 * Vérifie si une chaîne contient du HTML brut.
 */
export function containsRawHtml(input: string | undefined | null): boolean {
  if (!input) return false;
  return RAW_HTML_TAG_REGEX.test(input);
}

/**
 * Génère un identifiant d'ancre propre à partir d'un titre H2.
 */
export function slugifyHeadingId(heading: string, index = 1): string {
  const normalized = heading
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `section-${index}`;
}

/**
 * Analyse et valide les liens Markdown `[label](url)` dans une ligne de texte.
 * - Rejette les schémas dangereux ou HTTP non chiffrés sur les liens externes.
 * - Ajoute automatiquement `rel="noopener noreferrer"` et `target="_blank"` aux liens externes `https://`.
 */
export function normalizeMarkdownLinksInText(
  rawText: string,
  collectedLinks: ParsedMarkdownLink[],
  insecureLinks: string[]
): string {
  return rawText.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_full, rawLabel: string, rawHref: string) => {
      const label = rawLabel.trim();
      const href = rawHref.trim();

      if (href.startsWith('/') && !href.startsWith('//')) {
        collectedLinks.push({
          label,
          href,
          isExternal: false,
        });
        return `[${label}](${href})`;
      }

      if (/^https:\/\//i.test(href)) {
        try {
          const u = new URL(href);
          const isInternalDomain =
            u.hostname === 'vidnex.space' || u.hostname === 'www.vidnex.space';
          if (isInternalDomain) {
            collectedLinks.push({
              label,
              href: u.toString(),
              isExternal: false,
            });
            return `[${label}](${u.toString()})`;
          }
          collectedLinks.push({
            label,
            href: u.toString(),
            isExternal: true,
            rel: 'noopener noreferrer',
            target: '_blank',
          });
          return `[${label}](${u.toString()}){rel="noopener noreferrer" target="_blank"}`;
        } catch {
          insecureLinks.push(href);
          return label;
        }
      }

      insecureLinks.push(href);
      return label;
    }
  );
}

/**
 * Convertit un document Markdown restreint (H2, H3, paragraphes, listes, tableaux,
 * liens, bloc « conseil ») vers la structure `BlogContentSection[]` existante,
 * sans aucun HTML brut et sans modifier `BlogArticleView`.
 */
export function parseRestrictedBlogMarkdown(
  markdown: string
): RestrictedMarkdownResult {
  const raw = String(markdown || '').replace(/\r\n/g, '\n');
  const hasRawHtml = containsRawHtml(raw);
  const lines = raw.split('\n');

  let hasH1 = false;
  const links: ParsedMarkdownLink[] = [];
  const insecureExternalLinks: string[] = [];
  const sections: BlogContentSection[] = [];
  const tableOfContents: BlogTocItem[] = [];
  const usedIds = new Set<string>();

  let currentSection: BlogContentSection | null = null;
  let currentSubheadingIndex = -1;

  const ensureSection = (): BlogContentSection => {
    if (!currentSection) {
      const id = 'overview';
      usedIds.add(id);
      currentSection = {
        id,
        heading: 'Overview',
        paragraphs: [],
      };
      sections.push(currentSection);
      tableOfContents.push({ id, heading: currentSection.heading });
    }
    return currentSection;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Détection stricte de H1 (# Titre) interdit dans le corps
    if (/^#\s+\S/.test(trimmed)) {
      hasH1 = true;
      i++;
      continue;
    }

    // Section H2 (## Titre)
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      const rawHeading = h2Match[1].trim().replace(/\s+#+\s*$/, '');
      const heading = normalizeMarkdownLinksInText(
        rawHeading,
        links,
        insecureExternalLinks
      );
      let baseId = slugifyHeadingId(rawHeading, sections.length + 1);
      let uniqueId = baseId;
      let suffix = 2;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${baseId}-${suffix++}`;
      }
      usedIds.add(uniqueId);

      currentSection = {
        id: uniqueId,
        heading,
        paragraphs: [],
      };
      sections.push(currentSection);
      tableOfContents.push({ id: uniqueId, heading });
      currentSubheadingIndex = -1;
      i++;
      continue;
    }

    // Sous-titre H3 (### Sous-titre)
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      const sec = ensureSection();
      const subTitle = normalizeMarkdownLinksInText(
        h3Match[1].trim().replace(/\s+#+\s*$/, ''),
        links,
        insecureExternalLinks
      );
      if (!sec.subheadings) {
        sec.subheadings = [];
      }
      sec.subheadings.push({
        title: subTitle,
        body: '',
      });
      currentSubheadingIndex = sec.subheadings.length - 1;
      i++;
      continue;
    }

    // Bloc « conseil » : :::conseil [Label] ... ::: ou :::tip [Label] ... :::
    const calloutStart = trimmed.match(
      /^:::\s*(?:conseil|tip|astuce)(?:\s+(.+))?$/i
    );
    if (calloutStart) {
      const sec = ensureSection();
      const label = (calloutStart[1] || 'Conseil technique').trim();
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i].trim())) {
        const cl = lines[i].trim();
        if (cl) {
          bodyLines.push(
            normalizeMarkdownLinksInText(cl, links, insecureExternalLinks)
          );
        }
        i++;
      }
      if (i < lines.length && /^:::\s*$/.test(lines[i].trim())) {
        i++;
      }
      const text = bodyLines.join(' ').trim();
      if (text) {
        sec.technicalCallout = { label, text };
        sec.proTip = text;
      }
      continue;
    }

    // Bloc « conseil » alternatif en citation : > [!TIP] ou > **Conseil :**
    if (/^>\s*(?:\[!TIP\]|\*\*Conseil\s*:?\*\*|Conseil\s*:)/i.test(trimmed)) {
      const sec = ensureSection();
      const firstLineClean = trimmed
        .replace(/^>\s*(?:\[!TIP\]|\*\*Conseil\s*:?\*\*|Conseil\s*:)\s*/i, '')
        .trim();
      const bodyLines: string[] = firstLineClean ? [firstLineClean] : [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const subLine = lines[i].trim().replace(/^>\s?/, '').trim();
        if (subLine) bodyLines.push(subLine);
        i++;
      }
      const text = normalizeMarkdownLinksInText(
        bodyLines.join(' ').trim(),
        links,
        insecureExternalLinks
      );
      if (text) {
        sec.technicalCallout = {
          label: 'Conseil technique',
          text,
        };
        sec.proTip = text;
      }
      continue;
    }

    // Tableau Markdown : | Col 1 | Col 2 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith('|') &&
        lines[i].trim().endsWith('|')
      ) {
        tableLines.push(lines[i].trim());
        i++;
      }
      if (tableLines.length >= 2) {
        const parseRow = (rowLine: string): string[] =>
          rowLine
            .slice(1, -1)
            .split('|')
            .map((cell) =>
              normalizeMarkdownLinksInText(
                cell.trim(),
                links,
                insecureExternalLinks
              )
            );

        const headers = parseRow(tableLines[0]);
        const isSeparator = /^\|?[\s:-]+\|[\s|:-]*$/.test(tableLines[1]);
        const dataLines = isSeparator ? tableLines.slice(2) : tableLines.slice(1);
        const rows = dataLines.map(parseRow);
        const sec = ensureSection();
        sec.table = { headers, rows };
      }
      continue;
    }

    // Liste à puces (- item ou * item)
    if (/^[-*]\s+/.test(trimmed)) {
      const sec = ensureSection();
      if (!sec.bullets) {
        sec.bullets = [];
      }
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*]\s+/, '').trim();
        if (itemText) {
          sec.bullets.push(
            normalizeMarkdownLinksInText(itemText, links, insecureExternalLinks)
          );
        }
        i++;
      }
      continue;
    }

    // Paragraphe standard (regroupe les lignes consécutives non spéciales)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (
        !l ||
        /^#{1,6}\s+/.test(l) ||
        /^:::\s*/.test(l) ||
        /^>\s*/.test(l) ||
        /^[-*]\s+/.test(l) ||
        (l.startsWith('|') && l.endsWith('|'))
      ) {
        break;
      }
      paraLines.push(l);
      i++;
    }

    if (paraLines.length > 0) {
      const sec = ensureSection();
      const paragraphText = normalizeMarkdownLinksInText(
        paraLines.join(' ').trim(),
        links,
        insecureExternalLinks
      );
      if (
        currentSubheadingIndex >= 0 &&
        sec.subheadings &&
        sec.subheadings[currentSubheadingIndex]
      ) {
        const prev = sec.subheadings[currentSubheadingIndex].body;
        sec.subheadings[currentSubheadingIndex].body = prev
          ? `${prev} ${paragraphText}`
          : paragraphText;
        sec.paragraphs.push(
          `${sec.subheadings[currentSubheadingIndex].title} — ${paragraphText}`
        );
      } else {
        sec.paragraphs.push(paragraphText);
      }
    }
  }

  const plainWords = raw
    .replace(/[#*|:`>-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return {
    tableOfContents,
    content: sections,
    links,
    wordCount: plainWords.length,
    hasH1,
    hasRawHtml,
    insecureExternalLinks,
  };
}

/**
 * Convertit un tableau existant `BlogContentSection[]` en Markdown restreint canonique
 * (utilisé notamment lors de l'import des articles existants de `blogArticles.ts` vers D1).
 */
export function sectionsToRestrictedMarkdown(
  sections: BlogContentSection[]
): string {
  if (!Array.isArray(sections) || sections.length === 0) return '';
  const blocks: string[] = [];

  for (const sec of sections) {
    blocks.push(`## ${sec.heading.trim()}`);

    if (Array.isArray(sec.paragraphs)) {
      for (const p of sec.paragraphs) {
        if (p && p.trim()) {
          blocks.push(p.trim());
        }
      }
    }

    if (Array.isArray(sec.subheadings)) {
      for (const sub of sec.subheadings) {
        if (sub?.title) {
          blocks.push(`### ${sub.title.trim()}`);
          if (sub.body && sub.body.trim()) {
            blocks.push(sub.body.trim());
          }
        }
      }
    }

    if (Array.isArray(sec.bullets) && sec.bullets.length > 0) {
      blocks.push(sec.bullets.map((b) => `- ${b.trim()}`).join('\n'));
    }

    if (
      sec.table &&
      Array.isArray(sec.table.headers) &&
      sec.table.headers.length > 0
    ) {
      const headerRow = `| ${sec.table.headers.join(' | ')} |`;
      const sepRow = `| ${sec.table.headers.map(() => '---').join(' | ')} |`;
      const bodyRows = (sec.table.rows || []).map(
        (r) => `| ${r.join(' | ')} |`
      );
      blocks.push([headerRow, sepRow, ...bodyRows].join('\n'));
    }

    if (sec.technicalCallout && sec.technicalCallout.text) {
      const label = sec.technicalCallout.label || 'Conseil technique';
      blocks.push(
        `:::conseil ${label}\n${sec.technicalCallout.text.trim()}\n:::`
      );
    } else if (sec.proTip && sec.proTip.trim()) {
      blocks.push(`:::conseil Conseil technique\n${sec.proTip.trim()}\n:::`);
    }
  }

  return blocks.join('\n\n');
}

export interface ValidateBlogTranslationParams {
  locale: string;
  slug: string;
  title: string;
  excerpt?: string;
  metaTitle: string;
  metaDescription: string;
  bodyMarkdown: string;
  faq?: BlogFaqItem[];
  sources?: BlogExternalSource[];
  internalLinks?: BlogInternalLink[];
  existingSlugsInLocale?: Iterable<string>;
}

/**
 * Validation commune utilisée par l'API `/api/admin/blog` et par le build (`verify-seo.mjs`).
 * - Erreurs bloquantes : format du slug, présence d'une année dans le slug, unicité du slug par langue,
 *   `metaTitle <= 60`, `metaDescription` 90..150, H1 dans le corps, HTML brut, lien externe non-HTTPS.
 * - Avertissements non bloquants : longueur du corps, FAQ et sources.
 */
export function validateBlogTranslationInput(
  params: ValidateBlogTranslationParams
): BlogValidationResult {
  const errors: BlogValidationIssue[] = [];
  const warnings: BlogValidationWarning[] = [];

  const slug = String(params.slug || '').trim();
  const title = String(params.title || '').trim();
  const excerpt = String(params.excerpt || '').trim();
  const metaTitle = String(params.metaTitle || '').trim();
  const metaDescription = String(params.metaDescription || '').trim();
  const bodyMarkdown = String(params.bodyMarkdown || '');
  const faq = Array.isArray(params.faq) ? params.faq : [];
  const sources = Array.isArray(params.sources) ? params.sources : [];

  // 1. Validation du slug (lettres latines minuscules, chiffres et tirets, sans année, unique par langue)
  if (!slug || !SLUG_REGEX.test(slug)) {
    errors.push({
      code: 'INVALID_SLUG_FORMAT',
      field: 'slug',
      message:
        'Le slug doit contenir uniquement des lettres latines minuscules (a-z), des chiffres (0-9) et des tirets (-).',
    });
  } else if (YEAR_IN_SLUG_REGEX.test(slug)) {
    errors.push({
      code: 'SLUG_CONTAINS_YEAR',
      field: 'slug',
      message:
        'Le slug ne doit contenir aucune année (ex. 2025, 2026) afin de rester pérenne.',
    });
  }

  if (params.existingSlugsInLocale) {
    const existingSet = new Set(
      Array.from(params.existingSlugsInLocale, (s) => s.trim().toLowerCase())
    );
    if (slug && existingSet.has(slug.toLowerCase())) {
      errors.push({
        code: 'DUPLICATE_SLUG_IN_LOCALE',
        field: 'slug',
        message: `Le slug "${slug}" est déjà utilisé pour la langue "${params.locale}".`,
      });
    }
  }

  // 2. Titre
  if (!title) {
    errors.push({
      code: 'MISSING_TITLE',
      field: 'title',
      message: 'Le titre de la traduction est obligatoire.',
    });
  }

  // 3. metaTitle <= 60 caractères
  const metaTitleLen = [...metaTitle].length;
  if (metaTitleLen === 0) {
    errors.push({
      code: 'META_TITLE_EMPTY',
      field: 'metaTitle',
      message: 'Le metaTitle est obligatoire.',
    });
  } else if (metaTitleLen > 60) {
    errors.push({
      code: 'META_TITLE_TOO_LONG',
      field: 'metaTitle',
      message: `Le metaTitle dépasse 60 caractères (${metaTitleLen}/60).`,
    });
  }

  // 4. metaDescription entre 90 et 150 caractères
  const metaDescLen = [...metaDescription].length;
  if (metaDescLen < 90 || metaDescLen > 150) {
    errors.push({
      code: 'META_DESCRIPTION_OUT_OF_RANGE',
      field: 'metaDescription',
      message: `La metaDescription doit compter entre 90 et 150 caractères (actuellement ${metaDescLen}).`,
    });
  }

  // 5. Analyse du Markdown restreint (H1 interdit, HTML brut interdit, liens externes HTTPS)
  const parsedMarkdown = parseRestrictedBlogMarkdown(bodyMarkdown);

  if (parsedMarkdown.hasH1) {
    errors.push({
      code: 'H1_IN_BODY',
      field: 'body_markdown',
      message:
        'Les titres H1 (# ...) sont interdits dans le corps de l’article : utilisez uniquement H2 (##) et H3 (###).',
    });
  }

  const hasHtmlInFields =
    parsedMarkdown.hasRawHtml ||
    containsRawHtml(title) ||
    containsRawHtml(excerpt) ||
    containsRawHtml(metaTitle) ||
    containsRawHtml(metaDescription) ||
    faq.some(
      (f) => containsRawHtml(f?.question) || containsRawHtml(f?.answer)
    );

  if (hasHtmlInFields) {
    errors.push({
      code: 'RAW_HTML_FORBIDDEN',
      field: 'body_markdown',
      message: 'Le HTML brut est strictement interdit dans les articles.',
    });
  }

  const insecureSources = sources
    .map((s) => String(s?.url || '').trim())
    .filter((u) => u && !/^https:\/\//i.test(u));

  if (
    parsedMarkdown.insecureExternalLinks.length > 0 ||
    insecureSources.length > 0
  ) {
    errors.push({
      code: 'INSECURE_EXTERNAL_LINK',
      field: 'body_markdown',
      message:
        'Tous les liens externes doivent utiliser exclusivement le protocole sécurisé https://.',
    });
  }

  // 6. Avertissements non bloquants (longueur, FAQ, sources)
  if (parsedMarkdown.wordCount < 250) {
    warnings.push({
      code: 'SHORT_BODY_LENGTH',
      field: 'body_markdown',
      message: `Contenu court (${parsedMarkdown.wordCount} mots). Il est recommandé de rédiger au moins 250 mots.`,
    });
  }

  if (faq.length === 0) {
    warnings.push({
      code: 'MISSING_OR_SHORT_FAQ',
      field: 'faq',
      message:
        'Aucune question FAQ renseignée (avertissement non bloquant).',
    });
  }

  if (sources.length === 0) {
    warnings.push({
      code: 'MISSING_SOURCES',
      field: 'sources',
      message:
        'Aucune source externe renseignée (avertissement non bloquant).',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    parsedMarkdown,
  };
}

/**
 * Valide l'ensemble du dépôt statique `BLOG_ARTICLES` lors du build (`verify-seo.mjs`).
 */
export function validateStaticBlogRepository(articles: BlogArticle[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const slugsByLocale = new Map<string, Set<string>>();

  for (const article of articles) {
    for (const [locale, tr] of Object.entries(article.translations)) {
      if (!tr) continue;
      if (tr.translationStatus !== 'published' || article.status !== 'published') {
        continue;
      }
      const existing = slugsByLocale.get(locale) || new Set<string>();
      const bodyMd = sectionsToRestrictedMarkdown(tr.content);
      const res = validateBlogTranslationInput({
        locale,
        slug: tr.localizedSlug,
        title: tr.title,
        excerpt: tr.excerpt,
        metaTitle: tr.metaTitle,
        metaDescription: tr.metaDescription,
        bodyMarkdown: bodyMd,
        faq: tr.faq,
        sources: tr.sources,
        internalLinks: tr.internalLinks,
        existingSlugsInLocale: existing,
      });
      existing.add(tr.localizedSlug.toLowerCase());
      slugsByLocale.set(locale, existing);

      for (const err of res.errors) {
        errors.push(`[${article.id}:${locale}] ${err.code}: ${err.message}`);
      }
      for (const warn of res.warnings) {
        warnings.push(`[${article.id}:${locale}] ${warn.code}: ${warn.message}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
