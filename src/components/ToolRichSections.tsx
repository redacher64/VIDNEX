import React from 'react';
import {
  getLocalizedPagePath,
  type PageKey,
  type PlatformPageKey,
  type SupportedLocale,
} from '../i18n/config.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';
import type { ToolPageContent } from '../i18n/types.ts';
import { getSplitImageContent } from '../utils/splitImageLogic.ts';
import { getVideoToMp3Content } from '../utils/videoToMp3Logic.ts';
import { PlatformIcon } from './icons/PlatformIcons.tsx';

interface ToolRichSectionsProps {
  locale: SupportedLocale;
  toolContent: ToolPageContent;
  onNavigatePage: (pageKey: PageKey) => void;
  onNavigatePath?: (path: string) => void;
  compactContainer?: boolean;
}

export const ToolRichSections: React.FC<ToolRichSectionsProps> = ({
  locale,
  toolContent,
  onNavigatePage,
  onNavigatePath,
  compactContainer = false,
}) => {
  const bundle = getLocaleBundleSync(locale);
  const splitMeta = getSplitImageContent(locale);
  const videoMeta = getVideoToMp3Content(locale);
  const { formatsTable, troubleshooting, whereToFind, relatedSection } =
    toolContent;

  const containerClass = compactContainer
    ? 'w-full'
    : 'max-w-6xl mx-auto px-4 sm:px-6';
  const sectionPadClass = compactContainer
    ? 'mt-12'
    : 'w-full py-10 sm:py-14 border-t border-orange-200/60 dark:border-orange-900/40';

  const handlePageLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    target: PageKey
  ) => {
    e.preventDefault();
    onNavigatePage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePathLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string
  ) => {
    if (!onNavigatePath) return;
    e.preventDefault();
    onNavigatePath(targetPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const privacyHref = getLocalizedPagePath(locale, 'privacy');

  return (
    <>
      {/* FORMATS & QUALITIES HTML TABLE */}
      <section
        aria-labelledby="formats-table-heading"
        className={`${sectionPadClass} ${
          compactContainer ? '' : 'bg-[#fffaf5] dark:bg-[#140e0a]'
        }`}
      >
        <div className={containerClass}>
          <div className="mb-6">
            <h2
              id="formats-table-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
            >
              {formatsTable.heading}
            </h2>
            <p className="text-base text-[#6c4e40] dark:text-orange-200/80 mt-2 max-w-3xl leading-relaxed">
              {formatsTable.subheading}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-orange-200/90 dark:border-orange-900/60 bg-white/95 dark:bg-[#1c140e]/95 shadow-sm">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-orange-50/90 dark:bg-[#231710] border-b border-orange-200/80 dark:border-orange-900/60">
                  {formatsTable.headers.map((header, idx) => (
                    <th
                      key={idx}
                      scope="col"
                      className="px-4 sm:px-5 py-3.5 text-start font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-orange-950 dark:text-amber-300"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100/90 dark:divide-orange-900/40 text-sm sm:text-base">
                {formatsTable.rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-orange-50/40 dark:hover:bg-[#231710]/60 transition-colors"
                  >
                    <th
                      scope="row"
                      className="px-4 sm:px-5 py-3.5 text-start font-display font-semibold text-[#1f130b] dark:text-[#fffaf5] align-top"
                    >
                      {row[0]}
                    </th>
                    <td className="px-4 sm:px-5 py-3.5 font-mono text-xs sm:text-sm tabular-nums text-orange-800 dark:text-amber-300 align-top">
                      {row[1]}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-[#5b3f32] dark:text-orange-100/85 leading-relaxed align-top">
                      {row[2]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TROUBLESHOOTING SECTION */}
      <section
        aria-labelledby="troubleshooting-heading"
        className={`${sectionPadClass} ${
          compactContainer ? '' : 'bg-white/75 dark:bg-[#18110c]'
        }`}
      >
        <div className={containerClass}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h2
                id="troubleshooting-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
              >
                {troubleshooting.heading}
              </h2>
              <p className="text-base text-[#6c4e40] dark:text-orange-200/80 mt-2 max-w-3xl leading-relaxed">
                {troubleshooting.subheading}
              </p>
            </div>

            {troubleshooting.guideLink && (
              <a
                href={troubleshooting.guideLink.href}
                onClick={(e) =>
                  handlePathLink(e, troubleshooting.guideLink!.href)
                }
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 dark:bg-[#231710] border border-orange-300/80 dark:border-orange-800/70 text-sm font-display font-bold text-orange-800 dark:text-amber-300 hover:border-orange-500 transition-colors"
              >
                <span>{troubleshooting.guideLink.label}</span>
                <span aria-hidden="true" className="rtl:rotate-180">
                  →
                </span>
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {troubleshooting.items.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#fffaf5] dark:bg-[#1c140e] border border-orange-200/80 dark:border-orange-900/60 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs font-bold text-orange-700 dark:text-amber-400 bg-orange-100/80 dark:bg-[#2a1b12] px-2.5 py-1 rounded-lg shrink-0 mt-0.5 tabular-nums">
                    0{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-base sm:text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2">
                      {item.problem}
                    </h3>
                    <p className="text-sm sm:text-base text-[#5b3f32] dark:text-orange-200/85 leading-relaxed break-words">
                      {item.solution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHERE TO FIND DOWNLOADED FILES (iOS / ANDROID / DESKTOP) */}
      <section
        aria-labelledby="where-to-find-heading"
        className={`${sectionPadClass} ${
          compactContainer ? '' : 'bg-[#fffaf5] dark:bg-[#140e0a]'
        }`}
      >
        <div className={containerClass}>
          <div className="mb-6 sm:mb-8">
            <h2
              id="where-to-find-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
            >
              {whereToFind.heading}
            </h2>
            <p className="text-base text-[#6c4e40] dark:text-orange-200/80 mt-2 max-w-3xl leading-relaxed">
              {whereToFind.subheading}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              { key: 'ios', data: whereToFind.ios, tag: 'iOS / iPadOS' },
              { key: 'android', data: whereToFind.android, tag: 'Android' },
              { key: 'desktop', data: whereToFind.desktop, tag: 'Windows / macOS' },
            ].map((device) => (
              <div
                key={device.key}
                className="p-5 sm:p-6 rounded-2xl bg-white/95 dark:bg-[#1c140e]/95 border border-orange-200/90 dark:border-orange-900/60 shadow-sm flex flex-col"
              >
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-amber-400 mb-2">
                  {device.tag}
                </span>
                <h3 className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5] mb-2.5">
                  {device.data.title}
                </h3>
                <p className="text-sm sm:text-base text-[#5b3f32] dark:text-orange-200/85 leading-relaxed break-words">
                  {device.data.steps}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTERNAL LINKS: RELATED TOOLS + SAME-LANGUAGE BLOG GUIDE + PRIVACY PAGE */}
      <section
        aria-labelledby="related-resources-heading"
        className={`${sectionPadClass} ${
          compactContainer ? '' : 'bg-white/75 dark:bg-[#18110c]'
        }`}
      >
        <div className={containerClass}>
          <div className="mb-6">
            <h2
              id="related-resources-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-[#1f130b] dark:text-[#fffaf5]"
            >
              {relatedSection.heading}
            </h2>
            <p className="text-base text-[#6c4e40] dark:text-orange-200/80 mt-2 max-w-3xl leading-relaxed">
              {relatedSection.subheading}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedSection.toolKeys.map((targetKey) => {
              const href = getLocalizedPagePath(locale, targetKey);
              const isSplit = targetKey === 'split_image';
              const isVideoToMp3 = targetKey === 'video_to_mp3';
              const isBrowserTool = isSplit || isVideoToMp3;
              const title = isSplit
                ? splitMeta.h1
                : isVideoToMp3
                ? videoMeta.h1
                : bundle.platforms[targetKey as PlatformPageKey].h1;
              const subtitle = isSplit
                ? splitMeta.subtitle
                : isVideoToMp3
                ? videoMeta.subtitle
                : bundle.platforms[targetKey as PlatformPageKey].subtitle;
              const shortLabel = isSplit
                ? splitMeta.breadcrumbLabel
                : isVideoToMp3
                ? videoMeta.breadcrumbLabel
                : bundle.platforms[targetKey as PlatformPageKey].shortLabel;

              return (
                <a
                  key={targetKey}
                  href={href}
                  onClick={(e) => handlePageLink(e, targetKey)}
                  className="p-5 rounded-2xl bg-[#fffaf5] dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 hover:border-orange-500 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="inline-flex items-center gap-2 font-mono text-xs font-bold text-orange-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                      {!isBrowserTool && (
                        <PlatformIcon
                          platform={targetKey as PlatformPageKey}
                          className="w-4 h-4"
                        />
                      )}
                      <span>{shortLabel}</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors mb-1.5">
                      {title}
                    </h3>
                    <p className="text-sm text-[#6c4e40] dark:text-orange-200/80 leading-relaxed line-clamp-2">
                      {subtitle}
                    </p>
                  </div>
                  <div className="mt-4 pt-2.5 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between font-mono text-xs text-orange-800 dark:text-amber-400 font-bold">
                    <span>{bundle.ui.sections.openToolCta || shortLabel}</span>
                    <span aria-hidden="true" className="rtl:rotate-180">
                      →
                    </span>
                  </div>
                </a>
              );
            })}

            {relatedSection.guideLink && (
              <a
                href={relatedSection.guideLink.href}
                onClick={(e) =>
                  handlePathLink(e, relatedSection.guideLink!.href)
                }
                className="p-5 rounded-2xl bg-orange-50/70 dark:bg-[#231710] border border-orange-300/80 dark:border-orange-800/60 hover:border-orange-500 transition-all flex flex-col justify-between group"
              >
                <div>
                  <span className="inline-block font-mono text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-amber-400 mb-2">
                    BLOG · VIDNEX
                  </span>
                  <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors mb-1.5">
                    {relatedSection.guideLink.label}
                  </h3>
                  <p className="text-sm text-[#6c4e40] dark:text-orange-200/80 leading-relaxed">
                    {relatedSection.guideLink.description}
                  </p>
                </div>
                <div className="mt-4 pt-2.5 border-t border-orange-200/70 dark:border-orange-900/40 flex items-center justify-between font-mono text-xs text-orange-800 dark:text-amber-400 font-bold">
                  <span>{relatedSection.guideLink.label}</span>
                  <span aria-hidden="true" className="rtl:rotate-180">
                    →
                  </span>
                </div>
              </a>
            )}

            <a
              href={privacyHref}
              onClick={(e) => handlePageLink(e, 'privacy')}
              className="p-5 rounded-2xl bg-[#fffaf5] dark:bg-[#1c140e] border border-orange-200/90 dark:border-orange-900/60 hover:border-orange-500 transition-all flex flex-col justify-between group"
            >
              <div>
                <span className="inline-block font-mono text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-amber-400 mb-2">
                  {bundle.ui.footer.privacy}
                </span>
                <h3 className="font-display text-base font-bold text-[#1f130b] dark:text-[#fffaf5] group-hover:text-orange-600 dark:group-hover:text-amber-400 transition-colors mb-1.5">
                  {relatedSection.privacyLabel}
                </h3>
                <p className="text-sm text-[#6c4e40] dark:text-orange-200/80 leading-relaxed">
                  {relatedSection.privacyDescription}
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between font-mono text-xs text-orange-800 dark:text-amber-400 font-bold">
                <span>{bundle.ui.footer.privacy}</span>
                <span aria-hidden="true" className="rtl:rotate-180">
                  →
                </span>
              </div>
            </a>
          </div>
        </div>
      </section>
    </>
  );
};
