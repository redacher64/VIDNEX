import React, { useEffect } from 'react';
import { APP_DOMAIN, LEGAL_CONTACT_EMAIL } from '../config/appConfig';
import { LanguageCode } from '../i18n/translations';

export type LegalDocType = 'terms' | 'privacy' | 'dmca';

interface LegalModalProps {
  activeDoc: LegalDocType | null;
  onSelectDoc: (doc: LegalDocType) => void;
  onClose: () => void;
  language: LanguageCode;
}

const LEGAL_TAB_LABELS: Partial<
  Record<
    LanguageCode,
    Record<LegalDocType, string> & { closeLabel: string }
  >
> = {
  en: {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    dmca: 'DMCA / Copyright',
    closeLabel: 'Close',
  },
  fr: {
    terms: 'Conditions',
    privacy: 'Confidentialité',
    dmca: 'DMCA',
    closeLabel: 'Fermer',
  },
  es: {
    terms: 'Términos',
    privacy: 'Privacidad',
    dmca: 'DMCA',
    closeLabel: 'Cerrar',
  },
  pt: {
    terms: 'Termos',
    privacy: 'Privacidade',
    dmca: 'DMCA',
    closeLabel: 'Fechar',
  },
  ar: {
    terms: 'شروط الخدمة',
    privacy: 'سياسة الخصوصية',
    dmca: 'حقوق النشر DMCA',
    closeLabel: 'إغلاق',
  },
};

interface LegalDocumentContent {
  title: string;
  paragraphs: string[];
}

const LEGAL_CONTENT: Partial<
  Record<LanguageCode, Record<LegalDocType, LegalDocumentContent>>
> = {
  en: {
    terms: {
      title: `Terms of Service — ${APP_DOMAIN}`,
      paragraphs: [
        `VIDNEX (${APP_DOMAIN}) operates strictly as a client-initiated, stateless technical resolver for publicly accessible social media URLs. VIDNEX does not host, archive, or redistribute any video, audio, or image files on its servers.`,
        'Users are solely responsible for ensuring they have permission to download media from any URL submitted. Private accounts, subscriber-only content, and DRM-protected streams are strictly unsupported.',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      paragraphs: [
        'URLs pasted into VIDNEX are processed in volatile serverless memory solely to resolve the direct media stream for your active session. For certain videos, the link may be transmitted to a third-party media resolution service, without any account or cookie. We never log, persist, or monitor your submitted links, social handles, IP addresses, or downloaded files.',
        'Browser localStorage is used exclusively to remember your preferred display language and Light/Dark interface theme preference.',
      ],
    },
    dmca: {
      title: 'DMCA / Copyright Protection',
      paragraphs: [
        'VIDNEX hosts zero media files or uploaded content on its infrastructure. All downloads are directly streamed from official content delivery networks of the respective platforms.',
        'Rights holders who wish to block their public @handle or specific URLs from being resolved through VIDNEX may submit a formal request to our compliance contact:',
      ],
    },
  },
  fr: {
    terms: {
      title: `Conditions d'Utilisation — ${APP_DOMAIN}`,
      paragraphs: [
        `VIDNEX (${APP_DOMAIN}) fonctionne exclusivement comme un outil de résolution technique éphémère et sans état, initié par l'utilisateur pour les URLs publiques. VIDNEX n'héberge, n'archive et ne redistribue aucun fichier vidéo, audio ou image sur ses serveurs.`,
        'Les utilisateurs sont seuls responsables de s\'assurer qu\'ils disposent des droits nécessaires pour sauvegarder le média soumis. Les comptes privés et les flux protégés par DRM ne sont pas pris en charge.',
      ],
    },
    privacy: {
      title: 'Politique de Confidentialité',
      paragraphs: [
        'Les liens collés dans VIDNEX sont traités en mémoire vive éphémère uniquement pour résoudre le flux direct de votre session. Pour certaines vidéos, le lien peut être transmis à un service tiers de résolution de médias, sans compte ni cookie. Nous n\'enregistrons aucun historique, adresse IP ni média téléchargé sur disque.',
        'Le stockage local du navigateur (localStorage) est utilisé exclusivement pour mémoriser votre langue d\'affichage et votre préférence de thème (clair/sombre).',
      ],
    },
    dmca: {
      title: 'Protection des Droits d\'Auteur / DMCA',
      paragraphs: [
        'VIDNEX n\'héberge aucun contenu sur ses serveurs. Les fichiers proviennent directement des réseaux de diffusion officiels (CDN) des plateformes d\'origine.',
        'Les titulaires de droits souhaitant restreindre l\'extraction de leur identifiant public @handle ou d\'URLs spécifiques peuvent contacter directement notre équipe :',
      ],
    },
  },
  es: {
    terms: {
      title: `Términos de Servicio — ${APP_DOMAIN}`,
      paragraphs: [
        `VIDNEX (${APP_DOMAIN}) funciona estrictamente como un solucionador técnico sin estado e iniciado por el usuario para URLs públicas. VIDNEX no aloja, archiva ni redistribuye ningún archivo de vídeo, audio o imagen en sus servidores.`,
        'Los usuarios son los únicos responsables de garantizar que tienen permiso para descargar los contenidos. Las cuentas privadas y las transmisiones protegidas por DRM no son compatibles.',
      ],
    },
    privacy: {
      title: 'Política de Privacidad',
      paragraphs: [
        'Los enlaces pegados en VIDNEX se procesan en memoria volátil únicamente para resolver la transmisión directa de su sesión. Nunca almacenamos sus enlaces, identificadores ni archivos descargados.',
        'El almacenamiento local del navegador (localStorage) se utiliza exclusivamente para guardar sus preferencias de idioma y tema (claro/oscuro).',
      ],
    },
    dmca: {
      title: 'Derechos de Autor / DMCA',
      paragraphs: [
        'VIDNEX no aloja ningún archivo multimedia en su infraestructura. Los contenidos se transmiten directamente desde las redes CDN oficiales.',
        'Los titulares de derechos que deseen bloquear su usuario público o URLs específicas pueden contactar directamente a:',
      ],
    },
  },
  pt: {
    terms: {
      title: `Termos de Serviço — ${APP_DOMAIN}`,
      paragraphs: [
        `O VIDNEX (${APP_DOMAIN}) opera estritamente como um resolvedor técnico sem estado iniciado pelo usuário para URLs públicas. O VIDNEX não hospeda, arquiva ou redistribui arquivos de vídeo, áudio ou imagem em seus servidores.`,
        'Os usuários são os únicos responsáveis por garantir que possuem permissão para baixar as mídias. Contas privadas e transmissões protegidas por DRM não são suportadas.',
      ],
    },
    privacy: {
      title: 'Política de Privacidade',
      paragraphs: [
        'Os links colados no VIDNEX são processados em memória volátil apenas para resolver o fluxo direto da sua sessão. Nunca registramos seus links, perfis ou arquivos baixados.',
        'O armazenamento local do navegador (localStorage) é utilizado exclusivamente para memorizar o idioma e o tema (claro/escuro).',
      ],
    },
    dmca: {
      title: 'Direitos Autorais / DMCA',
      paragraphs: [
        'O VIDNEX não hospeda arquivos de mídia em sua infraestrutura. Todos os downloads são transmitidos diretamente das redes CDN oficiais das plataformas.',
        'Detentores de direitos autorais que desejam bloquear perfis públicos ou URLs específicas podem entrar em contato com:',
      ],
    },
  },
  ar: {
    terms: {
      title: `شروط الخدمة — ${APP_DOMAIN}`,
      paragraphs: [
        `يعمل VIDNEX (${APP_DOMAIN}) كأداة تقنية مستقلة ومؤقتة تعمل بطلب من المستخدم لجلب الروابط العامة المتاحة للجميع. لا يقوم VIDNEX باستضافة أو تخزين أو إعادة توزيع أي ملفات فيديو أو صوت أو صور على خوادمه نهائياً.`,
        'يتحمل المستخدمون المسؤولية الكاملة عن التأكد من امتلاكهم الإذن القانوني لتحميل الوسائط. لا يدعم الموقع الحسابات الخاصة أو البث المحمي بأنظمة إدارة الحقوق الرقمية (DRM).',
      ],
    },
    privacy: {
      title: 'سياسة الخصوصية',
      paragraphs: [
        'تتم معالجة الروابط في الذاكرة المؤقتة فقط لاستخراج رابط البث المباشر لجلستك. بالنسبة لبعض مقاطع الفيديو، قد يتم إرسال الرابط إلى خدمة خارجية (طرف ثالث) لاستخراج الوسائط، وذلك دون أي حساب أو ملفات تعريف ارتباط (Cookies). لا نقوم بتسجيل أو تخزين أي روابط أو أسماء مستخدمين أو عناوين IP أو ملفات محملة.',
        'يُستخدم التخزين المحلي في المتصفح (localStorage) حصرياً لحفظ لغة العرض المفضلة والمظهر الفاتح أو الداكن.',
      ],
    },
    dmca: {
      title: 'حماية حقوق النشر / DMCA',
      paragraphs: [
        'لا يستضيف VIDNEX أي ملفات وسائط على بنيته التحتية، ويتم نقل البيانات مباشرة وبشكل عابر من خوادم شبكات التوزيع (CDN) الرسمية للمنصات.',
        'يمكن لأصحاب حقوق النشر والتأليف الراغبين في حظر معالجة حساباتهم العامة أو روابط معينة التواصل مباشرة عبر البريد المخصص:',
      ],
    },
  },
};

export const LegalModal: React.FC<LegalModalProps> = ({
  activeDoc,
  onSelectDoc,
  onClose,
  language,
}) => {
  useEffect(() => {
    if (!activeDoc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDoc, onClose]);

  if (!activeDoc) return null;

  const labels = LEGAL_TAB_LABELS[language] || LEGAL_TAB_LABELS.en!;
  const contentDict = LEGAL_CONTENT[language] || LEGAL_CONTENT.en!;
  const currentContent = contentDict[activeDoc];
  const isRtl = language === 'ar';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[82vh] flex flex-col rounded-2xl bg-[#fffaf5] dark:bg-[#1c140e] border-2 border-orange-200/80 dark:border-orange-900/60 text-[#1f130b] dark:text-[#fffaf5] shadow-orange-glow overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-orange-200/80 dark:border-orange-900/60 bg-white/80 dark:bg-[#231710]">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['terms', 'privacy', 'dmca'] as LegalDocType[]).map((docKey) => {
              const isSelected = activeDoc === docKey;
              return (
                <button
                  key={docKey}
                  type="button"
                  onClick={() => onSelectDoc(docKey)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm'
                      : 'text-[#6c4e40] dark:text-orange-200/75 hover:text-orange-600 dark:hover:text-amber-400 hover:bg-orange-50 dark:hover:bg-orange-950/50'
                  }`}
                >
                  {labels[docKey]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-orange-50 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-800/70 text-xs font-semibold text-orange-950 dark:text-orange-100 hover:bg-orange-100 transition-colors"
          >
            {labels.closeLabel}
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-sm leading-relaxed text-[#6c4e40] dark:text-orange-200/80">
          <h2
            id="legal-modal-title"
            className="font-display text-lg font-bold text-[#1f130b] dark:text-[#fffaf5]"
          >
            {currentContent.title}
          </h2>

          {currentContent.paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}

          {activeDoc === 'dmca' && (
            <div
              dir="ltr"
              className="p-3.5 rounded-xl bg-orange-50 dark:bg-[#2a1b12] border border-orange-200/80 dark:border-orange-900/60 font-mono text-xs font-semibold text-orange-950 dark:text-orange-100 text-center sm:text-left"
            >
              {LEGAL_CONTACT_EMAIL}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
