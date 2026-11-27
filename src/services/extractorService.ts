import type { DetectedUrlInfo, MediaType, PlatformId } from '../utils/urlDetector.ts';
import type { LanguageCode } from '../i18n/translations.ts';
import { getLocaleBundleSync } from '../i18n/localeLoader.ts';

/**
 * Configuration API Cloudflare Pages Functions (`/functions/api`)
 * Les routes `/api/extract` et `/api/download` sont relatives au domaine Cloudflare Pages.
 */
export const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ?? ''
).replace(/\/+$/, '');

export function resolveApiUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('blob:')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export type ResultPayloadType = 'video' | 'profile_dp' | 'carousel';

export interface VideoFormatOption {
  id: string;
  label: string;
  quality: string;
  container: 'MP4' | 'MP3' | 'M4A' | 'JPG' | 'PNG';
  fileSize?: string;
  noWatermark: boolean;
  downloadUrl: string;
  isPrimary?: boolean;
}

export interface CarouselSlideItem {
  id: string;
  index: number;
  mediaType: 'image' | 'video';
  quality?: string;
  isThumbnail?: boolean;
  width?: number;
  height?: number;
  dimensions?: string;
  fileSize?: string;
  date?: string;
  selected?: boolean;
  label?: string;
  thumbnailUrl: string;
  downloadUrl: string;
}

export interface BaseMediaResult {
  id: string;
  payloadType: ResultPayloadType;
  platform: PlatformId;
  badgeLabel: string;
  sourceUrl: string;
  creatorHandle: string;
  creatorName: string;
  verified: boolean;
  extractedAt: string;
}

export interface StoryResultMeta {
  username: string;
  storyId?: string;
  takenAt?: string;
  expiresAt?: string;
  canListAll: boolean;
}

export interface VideoMediaResult extends BaseMediaResult {
  payloadType: 'video';
  title: string;
  duration?: string;
  aspectRatio: '9:16' | '16:9';
  resolution?: string;
  codec?: string;
  thumbnailUrl: string;
  formats: VideoFormatOption[];
  storyMeta?: StoryResultMeta;
}

export interface ProfileDpMediaResult extends BaseMediaResult {
  payloadType: 'profile_dp';
  biography: string;
  followersCount?: string;
  standardPreviewUrl: string;
  hdOriginalUrl: string;
  quality: 'HD' | 'Standard' | 'Miniature';
  isThumbnail?: boolean;
  dimensions?: string;
  fileSize?: string;
  format: 'JPG' | 'PNG' | 'WEBP';
}

export interface CarouselMediaResult extends BaseMediaResult {
  payloadType: 'carousel';
  caption: string;
  totalItems: number;
  archiveSize?: string;
  selectionContext?: 'carousel' | 'story' | 'highlight' | 'profile';
  items: CarouselSlideItem[];
  audioTrack?: {
    title: string;
    ext: 'mp3' | 'm4a';
    fileSize?: string;
    downloadUrl: string;
  };
}

export type MediaResult =
  | VideoMediaResult
  | ProfileDpMediaResult
  | CarouselMediaResult;

export class ExtractionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

const PROFILE_ERROR_MESSAGES: Record<
  LanguageCode,
  {
    NOT_FOUND: string;
    BLOCKED_BY_PLATFORM: string;
    PRIVATE_OR_LOGIN_REQUIRED: string;
    TIMEOUT: string;
  }
> = {
  fr: {
    NOT_FOUND:
      "Compte introuvable. Ce profil Instagram n'existe pas ou a été supprimé.",
    BLOCKED_BY_PLATFORM:
      'Instagram bloque temporairement la demande. Réessayez dans quelques minutes.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Impossible de récupérer la photo de profil publique pour ce profil Instagram.',
    TIMEOUT:
      "Délai d'attente dépassé lors de la récupération de la photo de profil Instagram. Réessayez plus tard.",
  },
  en: {
    NOT_FOUND:
      'Account not found. This Instagram profile does not exist or has been removed.',
    BLOCKED_BY_PLATFORM:
      'Instagram is temporarily blocking the request, please try again later.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Unable to retrieve the public profile photo for this Instagram profile.',
    TIMEOUT:
      'Request timed out while fetching the Instagram profile photo. Please try again.',
  },
  ar: {
    NOT_FOUND: 'الحساب غير موجود. ملف إنستغرام هذا غير موجود أو تم حذفه.',
    BLOCKED_BY_PLATFORM:
      'يحظر إنستغرام الطلب مؤقتاً، يرجى المحاولة مرة أخرى لاحقاً.',
    PRIVATE_OR_LOGIN_REQUIRED: 'تعذر جلب صورة الملف الشخصي العامة لحساب إنستغرام هذا.',
    TIMEOUT: 'انتهت مهلة الاتصال أثناء جلب صورة ملف إنستغرام الشخصي. حاول مرة أخرى.',
  },
  es: {
    NOT_FOUND:
      'Cuenta no encontrada. Este perfil de Instagram no existe o fue eliminado.',
    BLOCKED_BY_PLATFORM:
      'Instagram está bloqueando temporalmente la solicitud, inténtalo más tarde.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'No fue posible obtener la foto de perfil pública de este perfil de Instagram.',
    TIMEOUT:
      'Tiempo de espera agotado al obtener la foto de perfil de Instagram. Inténtalo de nuevo.',
  },
  pt: {
    NOT_FOUND:
      'Conta não encontrada. Este perfil do Instagram não existe ou foi removido.',
    BLOCKED_BY_PLATFORM:
      'O Instagram está bloqueando temporariamente a solicitação, tente novamente mais tarde.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Não foi possível obter a foto de perfil pública deste perfil do Instagram.',
    TIMEOUT:
      'Tempo limite esgotado ao buscar a foto de perfil do Instagram. Tente novamente.',
  },
  de: {
    NOT_FOUND:
      'Konto nicht gefunden. Dieses Instagram-Profil existiert nicht oder wurde gelöscht.',
    BLOCKED_BY_PLATFORM:
      'Instagram blockiert die Anfrage vorübergehend, bitte später erneut versuchen.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Das öffentliche Profilbild für dieses Instagram-Profil konnte nicht abgerufen werden.',
    TIMEOUT:
      'Zeitüberschreitung beim Abrufen des Instagram-Profilbilds. Bitte erneut versuchen.',
  },
  tr: {
    NOT_FOUND:
      'Hesap bulunamadı. Bu Instagram profili mevcut değil veya silinmiş.',
    BLOCKED_BY_PLATFORM:
      'Instagram isteği geçici olarak engelliyor, lütfen daha sonra tekrar deneyin.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Bu Instagram profilinin herkese açık profil fotoğrafı alınamadı.',
    TIMEOUT:
      'Instagram profil fotoğrafı alınırken zaman aşımı oluştu. Lütfen tekrar deneyin.',
  },
  id: {
    NOT_FOUND:
      'Akun tidak ditemukan. Profil Instagram ini tidak ada atau telah dihapus.',
    BLOCKED_BY_PLATFORM:
      'Instagram memblokir permintaan sementara, silakan coba lagi nanti.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Tidak dapat mengambil foto profil publik untuk profil Instagram ini.',
    TIMEOUT:
      'Waktu tunggu habis saat mengambil foto profil Instagram. Silakan coba lagi.',
  },
  it: {
    NOT_FOUND:
      'Account non trovato. Questo profilo Instagram non esiste o è stato rimosso.',
    BLOCKED_BY_PLATFORM:
      'Instagram sta temporaneamente bloccando la richiesta, riprova più tardi.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Impossibile recuperare la foto del profilo pubblica per questo profilo Instagram.',
    TIMEOUT:
      'Tempo scaduto durante il recupero della foto del profilo Instagram. Riprova.',
  },
  ru: {
    NOT_FOUND:
      'Аккаунт не найден. Этот профиль Instagram не существует или был удалён.',
    BLOCKED_BY_PLATFORM:
      'Instagram временно блокирует запрос, попробуйте позже.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Не удалось получить публичное фото для этого профиля Instagram.',
    TIMEOUT: 'Превышено время ожидания при загрузке фото профиля Instagram. Повторите попытку.',
  },
};

const LINKEDIN_ERROR_MESSAGES: Record<
  LanguageCode,
  {
    LOGIN_WALL: string;
    RATE_LIMITED: string;
    PROFILE_NOT_FOUND: string;
    PHOTO_NOT_AVAILABLE: string;
    INVALID_IMAGE: string;
    IMAGE_EXPIRED: string;
    NETWORK_ERROR: string;
    NOT_FOUND: string;
    BLOCKED_BY_PLATFORM: string;
    PRIVATE_OR_LOGIN_REQUIRED: string;
    TIMEOUT: string;
  }
> = {
  fr: {
    LOGIN_WALL:
      "LinkedIn bloque l'accès à cette photo pour le moment. Importez-la manuellement ci-dessous.",
    RATE_LIMITED:
      'Trop de requêtes envoyées vers LinkedIn (limite atteinte). Patientez quelques instants ou utilisez l’import manuel d’image ci-dessous.',
    PROFILE_NOT_FOUND:
      'Ce profil LinkedIn est introuvable ou a été supprimé (404). Vérifiez l’identifiant du profil dans l’URL.',
    PHOTO_NOT_AVAILABLE:
      'Aucune photo de profil publique n’est disponible sur ce compte LinkedIn (avatar absent ou par défaut).',
    INVALID_IMAGE:
      'Le fichier récupéré n’est pas une image valide (type MIME, signature binaire ou taille hors limite).',
    IMAGE_EXPIRED:
      'Le lien signé de la photo de profil LinkedIn a expiré. Relancez l’extraction pour obtenir un nouveau lien valide.',
    NETWORK_ERROR:
      'Impossible de contacter LinkedIn en raison d’une erreur réseau. Vérifiez votre connexion ou utilisez l’import manuel ci-dessous.',
    NOT_FOUND:
      'Ce profil LinkedIn est introuvable ou a été supprimé (404). Vérifiez l’identifiant du profil dans l’URL.',
    BLOCKED_BY_PLATFORM:
      "LinkedIn bloque l'accès à cette photo pour le moment. Importez-la manuellement ci-dessous.",
    PRIVATE_OR_LOGIN_REQUIRED:
      'Aucune photo de profil publique n’est disponible sur ce compte LinkedIn (avatar absent ou par défaut).',
    TIMEOUT:
      "Délai d'attente dépassé lors de la récupération de la photo de profil LinkedIn.",
  },
  en: {
    LOGIN_WALL:
      'LinkedIn is blocking access to this photo right now. Upload it manually below.',
    RATE_LIMITED:
      'Too many requests to LinkedIn (rate limit reached). Please wait a moment or use manual image upload below.',
    PROFILE_NOT_FOUND:
      'Profile not found. This LinkedIn profile does not exist or has been removed (404).',
    PHOTO_NOT_AVAILABLE:
      'No public profile photo is available for this LinkedIn account (missing or default avatar).',
    INVALID_IMAGE:
      'The retrieved file is not a valid image (invalid MIME type, magic bytes, or file size).',
    IMAGE_EXPIRED:
      'The signed LinkedIn profile photo link has expired. Please run the extraction again to obtain a fresh link.',
    NETWORK_ERROR:
      'Unable to reach LinkedIn due to a network error. Please check your connection or use manual upload below.',
    NOT_FOUND:
      'Profile not found. This LinkedIn profile does not exist or has been removed.',
    BLOCKED_BY_PLATFORM:
      'LinkedIn is blocking access to this photo right now. Upload it manually below.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'This LinkedIn profile is not public or has no public profile photo.',
    TIMEOUT:
      'Request timed out while fetching the LinkedIn profile photo.',
  },
  ar: {
    LOGIN_WALL:
      'يحظر لينكدإن الوصول إلى هذه الصورة حالياً. ارفعها يدوياً أدناه.',
    RATE_LIMITED:
      'تم تجاوز حد الطلبات نحو لينكدإن. يرجى الانتظار قليلاً أو استخدام الرفع اليدوي للصورة أدناه.',
    PROFILE_NOT_FOUND:
      'الملف الشخصي غير موجود. حساب لينكدإن هذا غير موجود أو تم حذفه (404).',
    PHOTO_NOT_AVAILABLE:
      'لا توجد صورة ملف شخصي عامة متاحة لحساب لينكدإن هذا.',
    INVALID_IMAGE:
      'الملف المستلم ليس صورة صالحة (نوع الملف أو البصمة الثنائية أو الحجم غير صالح).',
    IMAGE_EXPIRED:
      'انتهت صلاحية رابط صورة الملف الشخصي في لينكدإن. يرجى إعادة الاستخراج للحصول على رابط جديد.',
    NETWORK_ERROR:
      'تعذر الاتصال بلينكدإن بسبب خطأ في الشبكة. تحقق من اتصالك أو ارفع صورة يدوياً أدناه.',
    NOT_FOUND: 'الملف الشخصي غير موجود. حساب لينكدإن هذا غير موجود أو تم حذفه.',
    BLOCKED_BY_PLATFORM:
      'يحظر لينكدإن الوصول إلى هذه الصورة حالياً. ارفعها يدوياً أدناه.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'ملف لينكدإن الشخصي هذا غير عام أو لا يحتوي على صورة ملف شخصي عامة.',
    TIMEOUT: 'انتهت مهلة الاتصال أثناء جلب صورة ملف لينكدإن الشخصي.',
  },
  es: {
    LOGIN_WALL:
      'LinkedIn bloquea el acceso a esta foto por el momento. Súbela manualmente abajo.',
    RATE_LIMITED:
      'Demasiadas solicitudes a LinkedIn (límite alcanzado). Espera unos instantes o sube una imagen manualmente abajo.',
    PROFILE_NOT_FOUND:
      'Perfil no encontrado. Este perfil de LinkedIn no existe o fue eliminado (404).',
    PHOTO_NOT_AVAILABLE:
      'No hay ninguna foto de perfil pública disponible en esta cuenta de LinkedIn.',
    INVALID_IMAGE:
      'El archivo obtenido no es una imagen válida (tipo MIME, firma binaria o tamaño no válido).',
    IMAGE_EXPIRED:
      'El enlace firmado de la foto de perfil de LinkedIn ha caducado. Vuelve a extraer para obtener un enlace nuevo.',
    NETWORK_ERROR:
      'No se pudo conectar con LinkedIn por un error de red. Verifica tu conexión o sube una imagen manualmente abajo.',
    NOT_FOUND:
      'Perfil no encontrado. Este perfil de LinkedIn no existe o fue eliminado.',
    BLOCKED_BY_PLATFORM:
      'LinkedIn bloquea el acceso a esta foto por el momento. Súbela manualmente abajo.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Este perfil de LinkedIn no es público o no tiene foto de perfil pública.',
    TIMEOUT:
      'Tiempo de espera agotado al obtener la foto de perfil de LinkedIn.',
  },
  pt: {
    LOGIN_WALL:
      'O LinkedIn está bloqueando o acesso a esta foto no momento. Envie-a manualmente abaixo.',
    RATE_LIMITED:
      'Muitas solicitações para o LinkedIn (limite atingido). Aguarde um momento ou use o envio manual de imagem abaixo.',
    PROFILE_NOT_FOUND:
      'Perfil não encontrado. Este perfil do LinkedIn não existe ou foi removido (404).',
    PHOTO_NOT_AVAILABLE:
      'Nenhuma foto de perfil pública está disponível nesta conta do LinkedIn.',
    INVALID_IMAGE:
      'O arquivo obtido não é uma imagem válida (tipo MIME, assinatura binária ou tamanho inválido).',
    IMAGE_EXPIRED:
      'O link assinado da foto de perfil do LinkedIn expirou. Execute a extração novamente para obter um novo link.',
    NETWORK_ERROR:
      'Não foi possível conectar ao LinkedIn devido a um erro de rede. Verifique sua conexão ou envie uma imagem manualmente abaixo.',
    NOT_FOUND:
      'Perfil não encontrado. Este perfil do LinkedIn não existe ou foi removido.',
    BLOCKED_BY_PLATFORM:
      'O LinkedIn está bloqueando o acesso a esta foto no momento. Envie-a manualmente abaixo.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Este perfil do LinkedIn não é público ou não possui foto de perfil pública.',
    TIMEOUT:
      'Tempo limite esgotado ao buscar a foto de perfil do LinkedIn.',
  },
  de: {
    LOGIN_WALL:
      'LinkedIn blockiert derzeit den Zugriff auf dieses Foto. Laden Sie es unten manuell hoch.',
    RATE_LIMITED:
      'Zu viele Anfragen an LinkedIn (Ratenlimit erreicht). Bitte warten Sie kurz oder nutzen Sie den manuellen Bildupload.',
    PROFILE_NOT_FOUND:
      'Profil nicht gefunden. Dieses LinkedIn-Profil existiert nicht oder wurde gelöscht (404).',
    PHOTO_NOT_AVAILABLE:
      'Für dieses LinkedIn-Konto ist kein öffentliches Profilbild verfügbar.',
    INVALID_IMAGE:
      'Die abgerufene Datei ist kein gültiges Bild (MIME-Typ, Magic Bytes oder Größe ungültig).',
    IMAGE_EXPIRED:
      'Der signierte Link zum LinkedIn-Profilbild ist abgelaufen. Bitte starten Sie die Extraktion erneut.',
    NETWORK_ERROR:
      'Verbindung zu LinkedIn wegen eines Netzwerkfehlers fehlgeschlagen. Prüfen Sie Ihre Verbindung oder nutzen Sie den manuellen Bildupload.',
    NOT_FOUND:
      'Profil nicht gefunden. Dieses LinkedIn-Profil existiert nicht oder wurde gelöscht.',
    BLOCKED_BY_PLATFORM:
      'LinkedIn blockiert derzeit den Zugriff auf dieses Foto. Laden Sie es unten manuell hoch.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Dieses LinkedIn-Profil ist nicht öffentlich oder hat kein öffentliches Profilbild.',
    TIMEOUT:
      'Zeitüberschreitung beim Abrufen des LinkedIn-Profilbilds.',
  },
  tr: {
    LOGIN_WALL:
      'LinkedIn şu anda bu fotoğrafa erişimi engelliyor. Aşağıdan manuel olarak yükleyin.',
    RATE_LIMITED:
      'LinkedIn istek sınırı aşıldı. Biraz bekleyin veya aşağıdan manuel görsel yüklemeyi kullanın.',
    PROFILE_NOT_FOUND:
      'Profil bulunamadı. Bu LinkedIn profili mevcut değil veya silinmiş (404).',
    PHOTO_NOT_AVAILABLE:
      'Bu LinkedIn hesabında herkese açık bir profil fotoğrafı bulunmuyor.',
    INVALID_IMAGE:
      'Alınan dosya geçerli bir görsel değil (MIME türü, ikili imza veya boyut geçersiz).',
    IMAGE_EXPIRED:
      'LinkedIn profil fotoğrafı bağlantısının süresi doldu. Yeni bir bağlantı almak için işlemi tekrarlayın.',
    NETWORK_ERROR:
      'Ağ hatası nedeniyle LinkedIn’e ulaşılamadı. Bağlantınızı kontrol edin veya aşağıdan manuel görsel yükleyin.',
    NOT_FOUND:
      'Profil bulunamadı. Bu LinkedIn profili mevcut değil veya silinmiş.',
    BLOCKED_BY_PLATFORM:
      'LinkedIn şu anda bu fotoğrafa erişimi engelliyor. Aşağıdan manuel olarak yükleyin.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Bu LinkedIn profili herkese açık değil veya profil fotoğrafı yok.',
    TIMEOUT:
      'LinkedIn profil fotoğrafı alınırken zaman aşımı oluştu.',
  },
  id: {
    LOGIN_WALL:
      'LinkedIn memblokir akses ke foto ini saat ini. Unggah secara manual di bawah.',
    RATE_LIMITED:
      'Terlalu banyak permintaan ke LinkedIn (batas tercapai). Tunggu sebentar atau gunakan unggah gambar manual di bawah.',
    PROFILE_NOT_FOUND:
      'Profil tidak ditemukan. Profil LinkedIn ini tidak ada atau telah dihapus (404).',
    PHOTO_NOT_AVAILABLE:
      'Tidak ada foto profil publik yang tersedia untuk akun LinkedIn ini.',
    INVALID_IMAGE:
      'File yang diambil bukan gambar yang valid (tipe MIME, magic bytes, atau ukuran tidak valid).',
    IMAGE_EXPIRED:
      'Tautan foto profil LinkedIn telah kedaluwarsa. Silakan ulangi ekstraksi untuk mendapatkan tautan baru.',
    NETWORK_ERROR:
      'Tidak dapat menghubungi LinkedIn karena kesalahan jaringan. Periksa koneksi Anda atau unggah gambar secara manual di bawah.',
    NOT_FOUND:
      'Profil tidak ditemukan. Profil LinkedIn ini tidak ada atau telah dihapus.',
    BLOCKED_BY_PLATFORM:
      'LinkedIn memblokir akses ke foto ini saat ini. Unggah secara manual di bawah.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Profil LinkedIn ini tidak publik atau tidak memiliki foto profil publik.',
    TIMEOUT:
      'Waktu tunggu habis saat mengambil foto profil LinkedIn.',
  },
  it: {
    LOGIN_WALL:
      'LinkedIn blocca l’accesso a questa foto al momento. Caricala manualmente qui sotto.',
    RATE_LIMITED:
      'Troppe richieste verso LinkedIn (limite raggiunto). Attendi qualche istante o usa il caricamento manuale qui sotto.',
    PROFILE_NOT_FOUND:
      'Profilo non trovato. Questo profilo LinkedIn non esiste o è stato rimosso (404).',
    PHOTO_NOT_AVAILABLE:
      'Nessuna foto del profilo pubblica disponibile per questo account LinkedIn.',
    INVALID_IMAGE:
      'Il file recuperato non è un’immagine valida (tipo MIME, magic bytes o dimensione non valida).',
    IMAGE_EXPIRED:
      'Il link firmato della foto del profilo LinkedIn è scaduto. Ripeti l’estrazione per ottenere un nuovo link.',
    NETWORK_ERROR:
      'Impossibile contattare LinkedIn a causa di un errore di rete. Verifica la connessione o carica un’immagine manualmente qui sotto.',
    NOT_FOUND:
      'Profilo non trovato. Questo profilo LinkedIn non esiste o è stato rimosso.',
    BLOCKED_BY_PLATFORM:
      'LinkedIn blocca l’accesso a questa foto al momento. Caricala manualmente qui sotto.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Questo profilo LinkedIn non è pubblico o non ha una foto del profilo pubblica.',
    TIMEOUT:
      'Tempo scaduto durante il recupero della foto del profilo LinkedIn.',
  },
  ru: {
    LOGIN_WALL:
      'LinkedIn сейчас блокирует доступ к этому фото. Загрузите его вручную ниже.',
    RATE_LIMITED:
      'Слишком много запросов к LinkedIn (достигнут лимит). Подождите немного или загрузите изображение вручную ниже.',
    PROFILE_NOT_FOUND:
      'Профиль не найден. Этот профиль LinkedIn не существует или был удалён (404).',
    PHOTO_NOT_AVAILABLE:
      'Для этого аккаунта LinkedIn нет доступного публичного фото профиля.',
    INVALID_IMAGE:
      'Полученный файл не является допустимым изображением (неверный MIME-тип, сигнатура или размер).',
    IMAGE_EXPIRED:
      'Срок действия подписанной ссылки на фото профиля LinkedIn истёк. Повторите извлечение для получения новой ссылки.',
    NETWORK_ERROR:
      'Не удалось связаться с LinkedIn из-за ошибки сети. Проверьте подключение или загрузите изображение вручную ниже.',
    NOT_FOUND:
      'Профиль не найден. Этот профиль LinkedIn не существует или был удалён.',
    BLOCKED_BY_PLATFORM:
      'LinkedIn сейчас блокирует доступ к этому фото. Загрузите его вручную ниже.',
    PRIVATE_OR_LOGIN_REQUIRED:
      'Этот профиль LinkedIn не является публичным или не имеет публичного фото профиля.',
    TIMEOUT:
      'Превышено время ожидания при загрузке фото профиля LinkedIn.',
  },
};

export const STORY_ERROR_MESSAGES: Record<
  LanguageCode,
  {
    instagram: string;
    facebook: string;
  }
> = {
  fr: {
    instagram:
      'Les stories Instagram exigent une connexion : elles ne peuvent pas être téléchargées sans compte.',
    facebook:
      'Les stories Facebook exigent une connexion : elles ne peuvent pas être téléchargées sans compte.',
  },
  en: {
    instagram:
      'Instagram stories require a login: they cannot be downloaded without an account.',
    facebook:
      'Facebook stories require a login: they cannot be downloaded without an account.',
  },
  ar: {
    instagram:
      'قصص إنستغرام تتطلب تسجيل الدخول: لا يمكن تنزيلها بدون حساب.',
    facebook:
      'قصص فيسبوك تتطلب تسجيل الدخول: لا يمكن تنزيلها بدون حساب.',
  },
  es: {
    instagram:
      'Las historias de Instagram requieren iniciar sesión: no se pueden descargar sin una cuenta.',
    facebook:
      'Las historias de Facebook requieren iniciar sesión: no se pueden descargar sin una cuenta.',
  },
  pt: {
    instagram:
      'Os stories do Instagram exigem login: não podem ser baixados sem uma conta.',
    facebook:
      'Os stories do Facebook exigem login: não podem ser baixados sem uma conta.',
  },
  de: {
    instagram:
      'Instagram-Stories erfordern eine Anmeldung: Sie können ohne Konto nicht heruntergeladen werden.',
    facebook:
      'Facebook-Stories erfordern eine Anmeldung: Sie können ohne Konto nicht heruntergeladen werden.',
  },
  tr: {
    instagram:
      'Instagram hikayeleri giriş gerektirir: hesap olmadan indirilemez.',
    facebook:
      'Facebook hikayeleri giriş gerektirir: hesap olmadan indirilemez.',
  },
  id: {
    instagram:
      'Story Instagram memerlukan login: tidak dapat diunduh tanpa akun.',
    facebook:
      'Story Facebook memerlukan login: tidak dapat diunduh tanpa akun.',
  },
  it: {
    instagram:
      "Le storie di Instagram richiedono l'accesso: non possono essere scaricate senza un account.",
    facebook:
      "Le storie di Facebook richiedono l'accesso: non possono essere scaricate senza un account.",
  },
  ru: {
    instagram:
      'Истории Instagram требуют входа в аккаунт: их нельзя скачать без авторизации.',
    facebook:
      'Истории Facebook требуют входа в аккаунт: их нельзя скачать без авторизации.',
  },
};

export const FB_PHOTO_UNSUPPORTED_MESSAGES: Record<LanguageCode, string> = {
  fr: 'Les photos Facebook ne sont pas prises en charge. Collez un lien de vidéo ou de Reel Facebook public.',
  en: 'Facebook photos are not supported. Please paste a public Facebook video or Reel link.',
  ar: 'صور فيسبوك غير مدعومة. يرجى لصق رابط فيديو أو ريلز عام من فيسبوك.',
  es: 'Las fotos de Facebook no son compatibles. Pega un enlace de vídeo o Reel público de Facebook.',
  pt: 'As fotos do Facebook não são suportadas. Cole um link de vídeo ou Reel público do Facebook.',
  de: 'Facebook-Fotos werden nicht unterstützt. Bitte füge einen Link zu einem öffentlichen Facebook-Video oder Reel ein.',
  tr: 'Facebook fotoğrafları desteklenmiyor. Lütfen herkese açık bir Facebook video veya Reels bağlantısı yapıştırın.',
  id: 'Foto Facebook tidak didukung. Silakan tempel tautan video atau Reel Facebook publik.',
  it: 'Le foto di Facebook non sono supportate. Incolla il link di un video o Reel pubblico di Facebook.',
  ru: 'Фотографии Facebook не поддерживаются. Пожалуйста, вставьте ссылку на публичное видео или Reels Facebook.',
};

type SupportedErrorPlatform = 'instagram' | 'facebook' | 'tiktok' | 'x' | 'linkedin';
type NormalizedContentNounKey =
  | 'post'
  | 'reel'
  | 'story'
  | 'highlight'
  | 'profile'
  | 'photo'
  | 'video'
  | 'slideshow';

const PLATFORM_NAMES_BY_LOCALE: Record<
  LanguageCode,
  Record<SupportedErrorPlatform, string>
> = {
  fr: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  en: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  ar: {
    instagram: 'إنستغرام',
    facebook: 'فيسبوك',
    tiktok: 'تيك توك',
    x: 'إكس (تويتر)',
    linkedin: 'لينكدإن',
  },
  es: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  pt: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  de: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  tr: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  id: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  it: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
  ru: {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
  },
};

function normalizeErrorPlatform(
  platform?: PlatformId | string | null
): SupportedErrorPlatform | null {
  if (!platform) return null;
  const p = String(platform).toLowerCase().trim();
  if (p === 'instagram') return 'instagram';
  if (p === 'facebook' || p === 'fb') return 'facebook';
  if (p === 'tiktok') return 'tiktok';
  if (p === 'x' || p === 'twitter') return 'x';
  if (p === 'linkedin') return 'linkedin';
  return null;
}

function resolveContentNounKey(
  mediaType?: MediaType | null,
  platform?: SupportedErrorPlatform | null,
  isProfile?: boolean,
  isStory?: boolean
): NormalizedContentNounKey {
  if (isStory || mediaType === 'story') return 'story';
  if (mediaType === 'highlight') return 'highlight';
  if (isProfile || mediaType === 'profile' || platform === 'linkedin') return 'profile';
  if (mediaType === 'reel') return 'reel';
  if (mediaType === 'post') return 'post';
  if (mediaType === 'photo') return 'photo';
  if (mediaType === 'slideshow') return 'slideshow';
  if (mediaType === 'video') return 'video';
  if (platform === 'instagram' || platform === 'x') return 'post';
  return 'video';
}

function formatPlatformScopedError(
  platform: SupportedErrorPlatform,
  code: string,
  language: LanguageCode,
  nounKey: NormalizedContentNounKey
): string | null {
  const pName =
    (PLATFORM_NAMES_BY_LOCALE[language] || PLATFORM_NAMES_BY_LOCALE.fr)[platform];
  const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  if (language === 'fr') {
    const itemShort: Record<NormalizedContentNounKey, string> = {
      post: 'Cette publication',
      reel: 'Ce Reel',
      story: 'Cette story',
      highlight: 'Ce highlight',
      profile: 'Ce profil',
      photo: 'Cette photo',
      video: 'Cette vidéo',
      slideshow: 'Ce diaporama',
    };
    const itemThis: Record<NormalizedContentNounKey, string> = {
      post: `Cette publication ${pName}`,
      reel: `Ce Reel ${pName}`,
      story: `Cette story ${pName}`,
      highlight: `Ce highlight ${pName}`,
      profile: `Ce profil ${pName}`,
      photo: `Cette photo ${pName}`,
      video: `Cette vidéo ${pName}`,
      slideshow: `Ce diaporama ${pName}`,
    };
    const isFem =
      nounKey === 'post' || nounKey === 'story' || nounKey === 'photo' || nounKey === 'video';
    const subject = itemThis[nounKey];
    const shortSubject = itemShort[nounKey];

    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${shortSubject} n'est pas ${isFem ? 'publique' : 'public'} ou ${pName} demande une connexion. Seuls les contenus publics peuvent être téléchargés.`;
      case 'NOT_FOUND':
        return `${subject} est introuvable ou a été ${isFem ? 'supprimée' : 'supprimé'}.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} bloque temporairement l'accès à ${lcFirst(shortSubject)}. Veuillez réessayer dans quelques instants.`;
      case 'TIMEOUT':
        return `Délai d'attente dépassé lors de la récupération de ${lcFirst(subject)}. Vérifiez votre connexion et réessayez.`;
      case 'NO_MEDIA':
        return `${subject} ne contient aucun média téléchargeable.`;
      case 'UNSUPPORTED_URL':
        return `Ce lien ${pName} n'est pas reconnu ou pris en charge.`;
      case 'PLATFORM_DISABLED':
        return `L'extraction ${pName} est temporairement désactivée par l'administrateur.`;
      default:
        return null;
    }
  }

  if (language === 'en') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: 'post',
      reel: 'Reel',
      story: 'story',
      highlight: 'highlight',
      profile: 'profile',
      photo: 'photo',
      video: 'video',
      slideshow: 'slideshow',
    };
    const noun = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `This ${pName} ${noun} is not public or ${pName} requires a login. Only public content can be downloaded.`;
      case 'NOT_FOUND':
        return `${pName} ${noun} not found. It may have been deleted or removed.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} temporarily restricted access to this ${noun}. Please try again in a moment.`;
      case 'TIMEOUT':
        return `Fetching this ${pName} ${noun} took too long. Please check your connection and try again.`;
      case 'NO_MEDIA':
        return `This ${pName} ${noun} does not contain any downloadable media.`;
      case 'UNSUPPORTED_URL':
        return `This ${pName} link is not supported.`;
      case 'PLATFORM_DISABLED':
        return `The ${pName} downloader is temporarily disabled by the administrator.`;
      default:
        return null;
    }
  }

  if (language === 'ar') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: 'منشور',
      reel: 'ريلز',
      story: 'قصة',
      highlight: 'هايلات',
      profile: 'ملف شخصي',
      photo: 'صورة',
      video: 'فيديو',
      slideshow: 'عرض صور',
    };
    const noun = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${noun} ${pName} هذا غير عام أو يطلب ${pName} تسجيل الدخول. يمكن تنزيل المحتوى العام فقط.`;
      case 'NOT_FOUND':
        return `${noun} ${pName} غير موجود أو تم حذفه.`;
      case 'BLOCKED_BY_PLATFORM':
        return `يقيد ${pName} الوصول مؤقتاً إلى ${noun} ${pName} هذا. يرجى المحاولة لاحقاً.`;
      case 'TIMEOUT':
        return `انتهت مهلة الاتصال أثناء جلب ${noun} ${pName}. يرجى المحاولة مجدداً.`;
      case 'NO_MEDIA':
        return `لا يحتوي ${noun} ${pName} هذا على وسائط قابلة للتنزيل.`;
      case 'UNSUPPORTED_URL':
        return `رابط ${pName} هذا غير مدعوم.`;
      case 'PLATFORM_DISABLED':
        return `أداة استخراج ${pName} متوقفة مؤقتاً.`;
      default:
        return null;
    }
  }

  if (language === 'es') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: `Esta publicación de ${pName}`,
      reel: `Este Reel de ${pName}`,
      story: `Esta historia de ${pName}`,
      highlight: `Este destacado de ${pName}`,
      profile: `Este perfil de ${pName}`,
      photo: `Esta foto de ${pName}`,
      video: `Este vídeo de ${pName}`,
      slideshow: `Este carrusel de ${pName}`,
    };
    const subject = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${subject} no es público o ${pName} requiere iniciar sesión. Solo se pueden descargar contenidos públicos.`;
      case 'NOT_FOUND':
        return `${subject} no se encuentra o ha sido eliminado.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} bloquea temporalmente el acceso a ${lcFirst(subject)}. Inténtalo de nuevo en unos instantes.`;
      case 'TIMEOUT':
        return `Se agotó el tiempo de espera al obtener ${lcFirst(subject)}. Inténtalo de nuevo.`;
      case 'NO_MEDIA':
        return `${subject} no contiene ningún archivo multimedia descargable.`;
      case 'UNSUPPORTED_URL':
        return `Este enlace de ${pName} no es compatible.`;
      case 'PLATFORM_DISABLED':
        return `El descargador de ${pName} está desactivado temporalmente.`;
      default:
        return null;
    }
  }

  if (language === 'pt') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: `Esta publicação do ${pName}`,
      reel: `Este Reel do ${pName}`,
      story: `Este story do ${pName}`,
      highlight: `Este destaque do ${pName}`,
      profile: `Este perfil do ${pName}`,
      photo: `Esta foto do ${pName}`,
      video: `Este vídeo do ${pName}`,
      slideshow: `Este carrossel do ${pName}`,
    };
    const subject = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${subject} não é público ou o ${pName} exige login. Apenas conteúdos públicos podem ser baixados.`;
      case 'NOT_FOUND':
        return `${subject} não foi encontrada ou foi removida.`;
      case 'BLOCKED_BY_PLATFORM':
        return `O ${pName} bloqueou temporariamente o acesso a ${lcFirst(subject)}. Tente novamente em instantes.`;
      case 'TIMEOUT':
        return `Tempo limite esgotado ao carregar ${lcFirst(subject)}. Tente novamente.`;
      case 'NO_MEDIA':
        return `${subject} não contém mídia disponível para download.`;
      case 'UNSUPPORTED_URL':
        return `Este link do ${pName} não é suportado.`;
      case 'PLATFORM_DISABLED':
        return `O extrator do ${pName} está temporariamente desativado.`;
      default:
        return null;
    }
  }

  if (language === 'de') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: `Dieser ${pName}-Beitrag`,
      reel: `Dieses ${pName}-Reel`,
      story: `Diese ${pName}-Story`,
      highlight: `Dieses ${pName}-Highlight`,
      profile: `Dieses ${pName}-Profil`,
      photo: `Dieses ${pName}-Foto`,
      video: `Dieses ${pName}-Video`,
      slideshow: `Diese ${pName}-Diashow`,
    };
    const subject = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${subject} ist nicht öffentlich oder ${pName} erfordert eine Anmeldung. Nur öffentliche Inhalte können heruntergeladen werden.`;
      case 'NOT_FOUND':
        return `${subject} wurde nicht gefunden oder gelöscht.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} blockiert vorübergehend den Zugriff (${subject}). Bitte versuche es in Kürze erneut.`;
      case 'TIMEOUT':
        return `Zeitüberschreitung beim Abrufen (${subject}). Bitte erneut versuchen.`;
      case 'NO_MEDIA':
        return `${subject} enthält keine herunterladbaren Medien.`;
      case 'UNSUPPORTED_URL':
        return `Dieser ${pName}-Link wird nicht unterstützt.`;
      case 'PLATFORM_DISABLED':
        return `Der ${pName}-Downloader ist vorübergehend deaktiviert.`;
      default:
        return null;
    }
  }

  if (language === 'tr') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: `Bu ${pName} gönderisi`,
      reel: `Bu ${pName} Reels içeriği`,
      story: `Bu ${pName} hikayesi`,
      highlight: `Bu ${pName} öne çıkan içeriği`,
      profile: `Bu ${pName} profili`,
      photo: `Bu ${pName} fotoğrafı`,
      video: `Bu ${pName} videosu`,
      slideshow: `Bu ${pName} slaytı`,
    };
    const subject = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${subject} herkese açık değil veya ${pName} oturum açmayı gerektiriyor. Yalnızca herkese açık içerikler indirilebilir.`;
      case 'NOT_FOUND':
        return `${subject} bulunamadı veya silinmiş.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} bu içeriğe erişimi geçici olarak engelliyor (${subject}). Lütfen biraz sonra tekrar deneyin.`;
      case 'TIMEOUT':
        return `${subject} alınırken zaman aşımı oluştu. Lütfen tekrar deneyin.`;
      case 'NO_MEDIA':
        return `${subject} indirilebilir medya içermiyor.`;
      case 'UNSUPPORTED_URL':
        return `Bu ${pName} bağlantısı desteklenmiyor.`;
      case 'PLATFORM_DISABLED':
        return `${pName} indiricisi geçici olarak devre dışı bırakıldı.`;
      default:
        return null;
    }
  }

  if (language === 'id') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: `Postingan ${pName} ini`,
      reel: `Reel ${pName} ini`,
      story: `Story ${pName} ini`,
      highlight: `Sorotan ${pName} ini`,
      profile: `Profil ${pName} ini`,
      photo: `Foto ${pName} ini`,
      video: `Video ${pName} ini`,
      slideshow: `Slideshow ${pName} ini`,
    };
    const subject = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${subject} tidak publik atau ${pName} memerlukan login. Hanya konten publik yang dapat diunduh.`;
      case 'NOT_FOUND':
        return `${subject} tidak ditemukan atau telah dihapus.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} membatasi akses sementara ke ${lcFirst(subject)}. Silakan coba lagi nanti.`;
      case 'TIMEOUT':
        return `Waktu tunggu habis saat mengambil ${lcFirst(subject)}. Silakan coba lagi.`;
      case 'NO_MEDIA':
        return `${subject} tidak berisi media yang dapat diunduh.`;
      case 'UNSUPPORTED_URL':
        return `Tautan ${pName} ini tidak didukung.`;
      case 'PLATFORM_DISABLED':
        return `Pengunduh ${pName} dinonaktifkan sementara.`;
      default:
        return null;
    }
  }

  if (language === 'it') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: `Questo post ${pName}`,
      reel: `Questo Reel ${pName}`,
      story: `Questa storia ${pName}`,
      highlight: `Questo contenuto in evidenza ${pName}`,
      profile: `Questo profilo ${pName}`,
      photo: `Questa foto ${pName}`,
      video: `Questo video ${pName}`,
      slideshow: `Questa presentazione ${pName}`,
    };
    const subject = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${subject} non è pubblico o ${pName} richiede l'accesso. Solo i contenuti pubblici possono essere scaricati.`;
      case 'NOT_FOUND':
        return `${subject} non è stato trovato o è stato rimosso.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} ha temporaneamente bloccato l'accesso a ${lcFirst(subject)}. Riprova tra poco.`;
      case 'TIMEOUT':
        return `Tempo scaduto durante il recupero di ${lcFirst(subject)}. Riprova.`;
      case 'NO_MEDIA':
        return `${subject} non contiene file multimediali scaricabili.`;
      case 'UNSUPPORTED_URL':
        return `Questo link ${pName} non è supportato.`;
      case 'PLATFORM_DISABLED':
        return `Lo strumento per ${pName} è temporaneamente disattivato.`;
      default:
        return null;
    }
  }

  if (language === 'ru') {
    const nounMap: Record<NormalizedContentNounKey, string> = {
      post: `Эта публикация ${pName}`,
      reel: `Этот Reels ${pName}`,
      story: `Эта история ${pName}`,
      highlight: `Это актуальное ${pName}`,
      profile: `Этот профиль ${pName}`,
      photo: `Это фото ${pName}`,
      video: `Это видео ${pName}`,
      slideshow: `Это слайд-шоу ${pName}`,
    };
    const subject = nounMap[nounKey];
    switch (code) {
      case 'PRIVATE_OR_LOGIN_REQUIRED':
        return `${subject} не является публичным или ${pName} требует входа в аккаунт. Скачивать можно только публичный контент.`;
      case 'NOT_FOUND':
        return `${subject} не найдено или было удалено.`;
      case 'BLOCKED_BY_PLATFORM':
        return `${pName} временно ограничивает доступ (${subject}). Пожалуйста, попробуйте позже.`;
      case 'TIMEOUT':
        return `Превышено время ожидания при загрузке (${subject}). Повторите попытку.`;
      case 'NO_MEDIA':
        return `${subject} не содержит медиафайлов для скачивания.`;
      case 'UNSUPPORTED_URL':
        return `Эта ссылка ${pName} не поддерживается.`;
      case 'PLATFORM_DISABLED':
        return `Загрузчик ${pName} временно отключен.`;
      default:
        return null;
    }
  }

  return null;
}

const GENERIC_PLATFORM_FREE_UNSUPPORTED_URL: Record<LanguageCode, string> = {
  fr: 'Ce lien n’est pas reconnu ou n’est pas pris en charge. Veuillez coller un lien public valide.',
  en: 'Unsupported link. Please paste a valid public link.',
  ar: 'هذا الرابط غير مدعوم. يرجى لصق رابط عام صالح.',
  es: 'Enlace no compatible. Por favor, pega un enlace público válido.',
  pt: 'Link não suportado. Por favor, cole um link público válido.',
  de: 'Nicht unterstützter Link. Bitte füge einen gültigen öffentlichen Link ein.',
  tr: 'Desteklenmeyen bağlantı. Lütfen geçerli bir herkese açık bağlantı yapıştırın.',
  id: 'Tautan tidak didukung. Silakan tempel tautan publik yang valid.',
  it: 'Link non supportato. Inserisci un link pubblico valido.',
  ru: 'Ссылка не поддерживается. Вставьте корректную публичную ссылку.',
};

export function getLocalizedErrorMessage(
  code: string,
  language: LanguageCode = 'fr',
  options?: {
    isProfile?: boolean;
    isStory?: boolean;
    platform?: PlatformId | null;
    mediaType?: MediaType | null;
    serverMessage?: string;
  }
): string {
  const rawCode = (code || 'BLOCKED_BY_PLATFORM').trim();
  let prefixPlatform: SupportedErrorPlatform | null = null;
  let effectiveCode = rawCode;

  if (rawCode.includes('.')) {
    const [maybePlat, ...rest] = rawCode.split('.');
    const normPlat = normalizeErrorPlatform(maybePlat);
    if (normPlat && rest.length > 0) {
      prefixPlatform = normPlat;
      effectiveCode = rest.join('.');
    }
  }

  let effectivePlatform =
    normalizeErrorPlatform(options?.platform) || prefixPlatform;

  const storyDict = STORY_ERROR_MESSAGES[language] || STORY_ERROR_MESSAGES.fr;
  const storyFeatureDict =
    STORY_FEATURE_ERROR_MESSAGES[language] || STORY_FEATURE_ERROR_MESSAGES.fr;

  if (
    effectiveCode === 'STORIES_UNAVAILABLE' ||
    effectiveCode === 'STORY_ACCOUNT_PRIVATE' ||
    effectiveCode === 'STORY_ACCOUNT_NOT_FOUND' ||
    effectiveCode === 'STORY_NO_ACTIVE' ||
    effectiveCode === 'STORY_RATE_LIMITED'
  ) {
    return storyFeatureDict[effectiveCode];
  }

  const serverMsg = (options?.serverMessage || '').toLowerCase();
  const isStoryContext =
    options?.isStory ||
    options?.mediaType === 'story' ||
    options?.mediaType === 'highlight' ||
    effectiveCode === 'IG_STORY_LOGIN_REQUIRED' ||
    effectiveCode === 'FB_STORY_LOGIN_REQUIRED' ||
    serverMsg.includes('stories instagram') ||
    serverMsg.includes('stories facebook');

  if (
    isStoryContext &&
    (effectiveCode === 'PRIVATE_OR_LOGIN_REQUIRED' ||
      effectiveCode === 'IG_STORY_LOGIN_REQUIRED' ||
      effectiveCode === 'FB_STORY_LOGIN_REQUIRED')
  ) {
    if (
      effectivePlatform === 'facebook' ||
      effectiveCode === 'FB_STORY_LOGIN_REQUIRED' ||
      serverMsg.includes('stories facebook')
    ) {
      return storyDict.facebook;
    }
    return storyDict.instagram;
  }

  // Facebook unsupported photo
  if (
    effectiveCode === 'UNSUPPORTED_FB_PHOTO' ||
    (effectivePlatform === 'facebook' &&
      options?.mediaType === 'photo' &&
      (effectiveCode === 'UNSUPPORTED_URL' || effectiveCode === 'NO_MEDIA'))
  ) {
    return (
      FB_PHOTO_UNSUPPORTED_MESSAGES[language] ||
      FB_PHOTO_UNSUPPORTED_MESSAGES.fr
    );
  }

  const isProfileContext =
    Boolean(options?.isProfile) ||
    options?.mediaType === 'profile' ||
    effectivePlatform === 'linkedin' ||
    effectiveCode.startsWith('PROFILE_');

  if (isProfileContext && !effectivePlatform) {
    effectivePlatform = 'instagram';
  }

  const normalizedProfileCode = effectiveCode.startsWith('PROFILE_')
    ? effectiveCode.replace(/^PROFILE_/, '')
    : effectiveCode;

  if (isProfileContext && effectivePlatform === 'linkedin') {
    const liDict = LINKEDIN_ERROR_MESSAGES[language] || LINKEDIN_ERROR_MESSAGES.fr;
    if (effectiveCode === 'LOGIN_WALL') {
      return liDict.LOGIN_WALL;
    }
    if (effectiveCode === 'RATE_LIMITED') {
      return liDict.RATE_LIMITED;
    }
    if (effectiveCode === 'PROFILE_NOT_FOUND' || normalizedProfileCode === 'NOT_FOUND') {
      return liDict.PROFILE_NOT_FOUND;
    }
    if (effectiveCode === 'PHOTO_NOT_AVAILABLE') {
      return liDict.PHOTO_NOT_AVAILABLE;
    }
    if (effectiveCode === 'INVALID_IMAGE') {
      return liDict.INVALID_IMAGE;
    }
    if (effectiveCode === 'IMAGE_EXPIRED') {
      return liDict.IMAGE_EXPIRED;
    }
    if (effectiveCode === 'NETWORK_ERROR' || normalizedProfileCode === 'NETWORK_ERROR') {
      return liDict.NETWORK_ERROR;
    }
    if (normalizedProfileCode === 'BLOCKED_BY_PLATFORM') {
      return liDict.BLOCKED_BY_PLATFORM;
    }
    if (normalizedProfileCode === 'PRIVATE_OR_LOGIN_REQUIRED') {
      return liDict.PRIVATE_OR_LOGIN_REQUIRED;
    }
    if (normalizedProfileCode === 'TIMEOUT') {
      return liDict.TIMEOUT;
    }
  }

  if (isProfileContext && effectivePlatform === 'instagram') {
    const profileDict =
      PROFILE_ERROR_MESSAGES[language] || PROFILE_ERROR_MESSAGES.fr;

    if (normalizedProfileCode === 'NOT_FOUND') {
      return profileDict.NOT_FOUND;
    }
    if (normalizedProfileCode === 'BLOCKED_BY_PLATFORM') {
      return profileDict.BLOCKED_BY_PLATFORM;
    }
    if (normalizedProfileCode === 'PRIVATE_OR_LOGIN_REQUIRED') {
      return profileDict.PRIVATE_OR_LOGIN_REQUIRED;
    }
    if (normalizedProfileCode === 'TIMEOUT') {
      return profileDict.TIMEOUT;
    }
  }

  if (effectivePlatform) {
    const nounKey = resolveContentNounKey(
      options?.mediaType,
      effectivePlatform,
      isProfileContext,
      isStoryContext
    );
    const platformScoped = formatPlatformScopedError(
      effectivePlatform,
      normalizedProfileCode,
      language,
      nounKey
    );
    if (platformScoped) {
      return platformScoped;
    }
  }

  if (normalizedProfileCode === 'UNSUPPORTED_URL') {
    return (
      GENERIC_PLATFORM_FREE_UNSUPPORTED_URL[language] ||
      GENERIC_PLATFORM_FREE_UNSUPPORTED_URL.fr
    );
  }

  if (
    normalizedProfileCode === 'TURNSTILE_REQUIRED' ||
    normalizedProfileCode === 'TURNSTILE_FAILED' ||
    normalizedProfileCode === 'IP_BLOCKED'
  ) {
    return (
      options?.serverMessage ||
      getLocaleBundleSync(language).ui.errors.BLOCKED
    );
  }

  const dict = getLocaleBundleSync(language).ui.errors as unknown as Record<
    string,
    string
  >;
  return dict[normalizedProfileCode] || dict.BLOCKED_BY_PLATFORM;
}

/**
 * Appel principal de l'API Cloudflare Pages Function `/api/extract`
 */
export async function extractMediaFromUrl(
  url: string,
  detected: DetectedUrlInfo,
  language: LanguageCode = 'en',
  turnstileToken?: string | null
): Promise<MediaResult> {
  if (
    detected.unsupportedReason === 'FB_PHOTO_UNSUPPORTED' ||
    (detected.platform === 'facebook' && detected.mediaType === 'photo')
  ) {
    throw new ExtractionError(
      getLocalizedErrorMessage('UNSUPPORTED_FB_PHOTO', language, {
        platform: 'facebook',
        mediaType: 'photo',
      }),
      'UNSUPPORTED_FB_PHOTO'
    );
  }

  if (!detected.isValid || !detected.platform) {
    throw new ExtractionError(
      getLocalizedErrorMessage('UNSUPPORTED_URL', language, {
        platform: detected.platform,
        mediaType: detected.mediaType,
      }),
      'UNSUPPORTED_URL'
    );
  }

  const normalizedPlatform =
    detected.platform === 'twitter' ? 'x' : detected.platform;

  const queryParams = new URLSearchParams({
    url: detected.normalizedUrl || url,
    platform: normalizedPlatform,
  });

  const queryUrl = resolveApiUrl(`/api/extract?${queryParams.toString()}`);
  const cleanTurnstileToken = (turnstileToken || '').trim();

  let response: Response;
  try {
    response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(cleanTurnstileToken
          ? { 'X-Turnstile-Token': cleanTurnstileToken }
          : {}),
      },
    });
  } catch {
    try {
      response = await fetch(resolveApiUrl('/api/extract'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(cleanTurnstileToken
            ? { 'X-Turnstile-Token': cleanTurnstileToken }
            : {}),
        },
        body: JSON.stringify({
          url: detected.normalizedUrl || url,
          platform: normalizedPlatform,
          ...(cleanTurnstileToken
            ? { 'cf-turnstile-response': cleanTurnstileToken }
            : {}),
        }),
      });
    } catch {
      throw new ExtractionError(
        getLocalizedErrorMessage('NETWORK_ERROR', language, {
          platform: detected.platform,
          mediaType: detected.mediaType,
          isProfile:
            detected.mediaType === 'profile' || detected.platform === 'linkedin',
        }),
        'NETWORK_ERROR'
      );
    }
  }

  const data: any = await response.json().catch(() => null);

  if (!data || !data.ok || data.error) {
    const errCode = data?.error?.code || 'BLOCKED_BY_PLATFORM';
    const localized = getLocalizedErrorMessage(errCode, language, {
      isProfile:
        detected.mediaType === 'profile' || detected.platform === 'linkedin',
      isStory:
        detected.mediaType === 'story' || detected.mediaType === 'highlight',
      platform: detected.platform,
      mediaType: detected.mediaType,
      serverMessage: data?.error?.message,
    });
    throw new ExtractionError(localized, errCode);
  }

  return mapExtractResponseToMediaResult(data, url, detected);
}

export function mapExtractResponseToMediaResult(
  data: any,
  url: string,
  detected: DetectedUrlInfo
): MediaResult {
  const platform: PlatformId =
    (data.platform as PlatformId) ||
    (detected.platform as PlatformId) ||
    'tiktok';
  const creatorHandle = `@${(data.author?.username || detected.identifier || 'user').replace(/^@/, '')}`;
  const fullAuthorName =
    platform === 'linkedin'
      ? ''
      : data.author?.full_name ||
        (data.author?.nickname && data.author.nickname !== creatorHandle
          ? data.author.nickname
          : '');
  const authorName = fullAuthorName || creatorHandle;
  const nowTime = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const badgeLabel =
    detected.badgeLabel ||
    (platform === 'tiktok'
      ? 'TikTok Video'
      : platform === 'x' || platform === 'twitter'
      ? `X Post (${creatorHandle})`
      : platform === 'facebook'
      ? 'Facebook Video'
      : platform === 'linkedin'
      ? `LinkedIn (${creatorHandle})`
      : 'Instagram Reel');

  const visualItems = (data.items || []).filter(
    (it: any) => it.kind === 'image' || it.kind === 'video'
  );

  const hasSingleStoryMeta = Boolean(
    data.storyMeta &&
      typeof data.storyMeta.username === 'string' &&
      visualItems.length === 1
  );

  const isMultiItemSelection =
    !hasSingleStoryMeta &&
    (data.type === 'carousel' ||
      ((detected.mediaType === 'story' || detected.mediaType === 'highlight') &&
        visualItems.length > 0) ||
      (data.type !== 'video' && visualItems.length > 1));

  // 1. Format Photo de Profil (DP) unique (sans stories actives multiples)
  const isProfilePayload =
    !isMultiItemSelection &&
    (data.type === 'profile' ||
      detected.mediaType === 'profile' ||
      platform === 'linkedin' ||
      (platform === 'instagram' &&
        data.type === 'image' &&
        typeof data.title === 'string' &&
        /^@[a-z0-9._]{1,30}$/i.test(data.title.trim())));

  if (isProfilePayload) {
    const dpItem = data.items?.[0];
    const previewUrl = resolveApiUrl(
      data.thumbnail || data.author?.avatar || dpItem?.url || ''
    );
    const downloadUrl = resolveApiUrl(dpItem?.url || previewUrl);
    const realDimensions =
      dpItem?.width && dpItem?.height
        ? `${dpItem.width} × ${dpItem.height}`
        : dpItem?.dimensions || undefined;
    const rawQuality = String(dpItem?.quality || '').toLowerCase();
    const isThumb =
      Boolean(dpItem?.isThumbnail) ||
      rawQuality === 'miniature' ||
      (platform === 'linkedin' && rawQuality !== 'hd' && rawQuality !== 'standard');
    const itemQuality: 'HD' | 'Standard' | 'Miniature' = isThumb
      ? 'Miniature'
      : rawQuality === 'standard'
      ? 'Standard'
      : 'HD';
    const rawExt = String(dpItem?.ext || 'jpg').toLowerCase();
    const itemFormat: 'JPG' | 'PNG' | 'WEBP' =
      rawExt === 'png' ? 'PNG' : rawExt === 'webp' ? 'WEBP' : 'JPG';

    return {
      id: `dp-${Date.now()}`,
      payloadType: 'profile_dp',
      platform,
      badgeLabel:
        platform === 'tiktok'
          ? `TikTok Profile (${creatorHandle})`
          : platform === 'linkedin'
          ? `LinkedIn (${creatorHandle})`
          : `Instagram Profile (${creatorHandle})`,
      sourceUrl: url,
      creatorHandle: platform === 'linkedin' ? data.title || creatorHandle : creatorHandle,
      creatorName: platform === 'linkedin' ? '' : fullAuthorName,
      verified: Boolean(data.author?.verified),
      extractedAt: nowTime,
      biography: platform === 'linkedin' ? '' : data.author?.biography || data.title || '',
      followersCount: platform === 'linkedin' ? undefined : data.author?.followers || undefined,
      standardPreviewUrl: previewUrl,
      hdOriginalUrl: downloadUrl,
      quality: itemQuality,
      isThumbnail: isThumb,
      dimensions: realDimensions,
      fileSize: dpItem?.size || undefined,
      format: itemFormat,
    };
  }

  // 2. Écran de Sélection (Carrousel, Diaporama, Stories d'un compte, Highlights, Profil avec stories actives, ou Repli LinkedIn)
  if (isMultiItemSelection) {
    const selectionContext: CarouselMediaResult['selectionContext'] =
      detected.mediaType === 'story'
        ? 'story'
        : detected.mediaType === 'highlight'
        ? 'highlight'
        : detected.mediaType === 'profile' || platform === 'linkedin'
        ? 'profile'
        : 'carousel';

    const items: CarouselSlideItem[] = visualItems.map((it: any, idx: number) => {
      const itemIndex = typeof it.index === 'number' ? it.index : idx + 1;
      const width = typeof it.width === 'number' ? it.width : undefined;
      const height = typeof it.height === 'number' ? it.height : undefined;
      const defaultQuality =
        it.quality ||
        (it.kind === 'video'
          ? '1080p'
          : platform === 'linkedin'
          ? 'Miniature'
          : platform === 'x'
          ? 'Original'
          : '1080p');

      return {
        id: it.id ? `slide-${it.id}-${idx + 1}` : `slide-${idx + 1}`,
        index: itemIndex,
        mediaType: it.kind === 'video' ? 'video' : 'image',
        quality: String(defaultQuality),
        isThumbnail:
          Boolean(it.isThumbnail) ||
          String(defaultQuality).toLowerCase() === 'miniature',
        width,
        height,
        dimensions:
          width && height
            ? `${width} × ${height}`
            : it.dimensions || undefined,
        fileSize: it.size || undefined,
        date: typeof it.date === 'string' ? it.date : undefined,
        selected: typeof it.selected === 'boolean' ? it.selected : undefined,
        label: typeof it.label === 'string' ? it.label : undefined,
        thumbnailUrl: resolveApiUrl(it.thumbnail || it.url),
        downloadUrl: resolveApiUrl(it.url),
      };
    });

    const audioItem = (data.items || []).find(
      (it: any) => it.kind === 'audio' && typeof it.url === 'string' && it.url.trim().length > 0
    );
    const resolvedId = String(
      data.id ||
        (detected.normalizedUrl || url).match(/\/(?:video|photo)\/([0-9]{10,25})/)?.[1] ||
        `car-${Date.now()}`
    ).replace(/[^a-zA-Z0-9_-]/g, '');

    const carouselAudioExt: 'mp3' | 'm4a' =
      String(audioItem?.ext || '').toLowerCase() === 'mp3' ? 'mp3' : 'm4a';

    return {
      id: resolvedId,
      payloadType: 'carousel',
      platform,
      badgeLabel:
        selectionContext === 'story'
          ? `${badgeLabel} (Stories)`
          : selectionContext === 'highlight'
          ? `${badgeLabel} (Highlights)`
          : `${badgeLabel} (Carousel)`,
      sourceUrl: url,
      creatorHandle,
      creatorName: authorName,
      verified: Boolean(data.author?.verified),
      extractedAt: nowTime,
      caption: data.title || `${creatorHandle}`,
      totalItems: items.length,
      archiveSize: undefined,
      selectionContext,
      items,
      audioTrack: audioItem
        ? {
            title: carouselAudioExt === 'mp3' ? 'Audio MP3' : 'Audio M4A',
            ext: carouselAudioExt,
            fileSize: audioItem.size || undefined,
            downloadUrl: resolveApiUrl(audioItem.url),
          }
        : undefined,
    };
  }

  // 3. Format Vidéo (multi-qualités MP4) ou Image Unique HD
  const mediaItems = (data.items || []).filter(
    (it: any) => it.kind === 'video' || it.kind === 'image'
  );
  const primaryMedia = mediaItems[0] || data.items?.[0];
  const audioItem = (data.items || []).find(
    (it: any) => it.kind === 'audio' && typeof it.url === 'string' && it.url.trim().length > 0
  );
  const resolvedVideoId = String(
    data.id ||
      (detected.normalizedUrl || url).match(/\/(?:video|photo)\/([0-9]{10,25})/)?.[1] ||
      `vid-${Date.now()}`
  ).replace(/[^a-zA-Z0-9_-]/g, '');

  const formats: VideoFormatOption[] = [];

  if (mediaItems.length > 0) {
    mediaItems.forEach((it: any, index: number) => {
      const isImage = it.kind === 'image' || data.type === 'image';
      const extUpper = String(it.ext || (isImage ? 'jpg' : 'mp4')).toUpperCase();
      const container: VideoFormatOption['container'] =
        extUpper === 'PNG' ? 'PNG' : isImage ? 'JPG' : 'MP4';
      const qualityLabel = String(
        it.quality || (isImage ? 'Original' : index === 0 ? '1080p' : '720p')
      );

      let label: string;
      if (isImage) {
        label = `Download Original Image (${container} ${qualityLabel})`;
      } else if (index === 0) {
        label = `Download HD ${qualityLabel} (MP4)`;
      } else {
        label = `Download MP4 ${qualityLabel}`;
      }

      formats.push({
        id: `fmt-${index}-${qualityLabel}`,
        label,
        quality: qualityLabel,
        container,
        fileSize: it.size || undefined,
        noWatermark: true,
        downloadUrl: resolveApiUrl(it.url),
        isPrimary: index === 0,
      });
    });
  } else if (primaryMedia) {
    formats.push({
      id: 'hd-1080p',
      label: 'Download HD 1080p (No Watermark)',
      quality: '1080p',
      container: 'MP4',
      fileSize: primaryMedia.size || undefined,
      noWatermark: true,
      downloadUrl: resolveApiUrl(primaryMedia.url),
      isPrimary: true,
    });
  }

  if (audioItem) {
    const audioExt: 'mp3' | 'm4a' =
      String(audioItem.ext || '').toLowerCase() === 'mp3' ? 'mp3' : 'm4a';
    const audioContainer: 'MP3' | 'M4A' = audioExt === 'mp3' ? 'MP3' : 'M4A';
    formats.push({
      id: `audio-${audioExt}`,
      label: `Download Audio (${audioContainer})`,
      quality: 'Audio',
      container: audioContainer,
      fileSize: audioItem.size || undefined,
      noWatermark: true,
      downloadUrl: resolveApiUrl(audioItem.url),
    });
  }

  const realResolution =
    primaryMedia?.width && primaryMedia?.height
      ? `${primaryMedia.width} × ${primaryMedia.height}`
      : primaryMedia?.quality
      ? primaryMedia.quality === 'HD' || primaryMedia.quality === 'SD'
        ? `MP4 · ${primaryMedia.quality}`
        : `${primaryMedia.quality} HD`
      : undefined;

  const storyMeta: StoryResultMeta | undefined = data.storyMeta
    ? {
        username: String(data.storyMeta.username || '').replace(/^@/, ''),
        storyId: data.storyMeta.storyId
          ? String(data.storyMeta.storyId)
          : undefined,
        takenAt: data.storyMeta.takenAt
          ? String(data.storyMeta.takenAt)
          : undefined,
        expiresAt: data.storyMeta.expiresAt
          ? String(data.storyMeta.expiresAt)
          : undefined,
        canListAll: Boolean(data.storyMeta.canListAll),
      }
    : undefined;

  return {
    id: resolvedVideoId,
    payloadType: 'video',
    platform,
    badgeLabel,
    sourceUrl: url,
    creatorHandle,
    creatorName: authorName,
    verified: Boolean(data.author?.verified),
    extractedAt: nowTime,
    title: data.title || creatorHandle,
    duration: data.duration || undefined,
    aspectRatio:
      primaryMedia?.width &&
      primaryMedia?.height &&
      primaryMedia.width >= primaryMedia.height
        ? '16:9'
        : '9:16',
    resolution: realResolution,
    codec: undefined,
    thumbnailUrl: resolveApiUrl(data.thumbnail || primaryMedia?.url || ''),
    formats,
    ...(storyMeta ? { storyMeta } : {}),
  };
}

export const STORY_FEATURE_ERROR_MESSAGES: Record<
  LanguageCode,
  {
    STORIES_UNAVAILABLE: string;
    STORY_ACCOUNT_PRIVATE: string;
    STORY_ACCOUNT_NOT_FOUND: string;
    STORY_NO_ACTIVE: string;
    STORY_RATE_LIMITED: string;
  }
> = {
  fr: {
    STORIES_UNAVAILABLE: 'Les stories sont temporairement indisponibles.',
    STORY_ACCOUNT_PRIVATE:
      'Ce compte Instagram est privé. Seules les stories des comptes publics peuvent être consultées.',
    STORY_ACCOUNT_NOT_FOUND:
      'Compte Instagram introuvable. Vérifiez le nom d’utilisateur.',
    STORY_NO_ACTIVE:
      'Aucune story active trouvée pour ce compte (les stories disparaissent après 24 h).',
    STORY_RATE_LIMITED:
      'Limite horaire atteinte pour le chargement des stories. Veuillez réessayer plus tard.',
  },
  en: {
    STORIES_UNAVAILABLE: 'Stories are temporarily unavailable.',
    STORY_ACCOUNT_PRIVATE:
      'This Instagram account is private. Only stories from public accounts can be viewed.',
    STORY_ACCOUNT_NOT_FOUND:
      'Instagram account not found. Please check the username.',
    STORY_NO_ACTIVE:
      'No active stories found for this account (stories expire after 24 hours).',
    STORY_RATE_LIMITED:
      'Hourly limit reached for loading stories. Please try again later.',
  },
  ar: {
    STORIES_UNAVAILABLE: 'القصص غير متاحة مؤقتاً.',
    STORY_ACCOUNT_PRIVATE:
      'حساب إنستغرام هذا خاص. يمكن عرض قصص الحسابات العامة فقط.',
    STORY_ACCOUNT_NOT_FOUND:
      'لم يتم العثور على حساب إنستغرام هذا. يرجى التحقق من اسم المستخدم.',
    STORY_NO_ACTIVE:
      'لا توجد قصص نشطة لهذا الحساب حالياً (تختفي القصص بعد 24 ساعة).',
    STORY_RATE_LIMITED:
      'تم بلوغ الحد الساعي لتحميل القصص. يرجى المحاولة لاحقاً.',
  },
  es: {
    STORIES_UNAVAILABLE: 'Las historias no están disponibles temporalmente.',
    STORY_ACCOUNT_PRIVATE:
      'Esta cuenta de Instagram es privada. Solo se pueden consultar historias de cuentas públicas.',
    STORY_ACCOUNT_NOT_FOUND:
      'Cuenta de Instagram no encontrada. Verifica el nombre de usuario.',
    STORY_NO_ACTIVE:
      'No hay historias activas para esta cuenta (las historias desaparecen tras 24 h).',
    STORY_RATE_LIMITED:
      'Se alcanzó el límite por hora para cargar historias. Inténtalo más tarde.',
  },
  pt: {
    STORIES_UNAVAILABLE: 'Os stories estão temporariamente indisponíveis.',
    STORY_ACCOUNT_PRIVATE:
      'Esta conta do Instagram é privada. Apenas stories de contas públicas podem ser acessados.',
    STORY_ACCOUNT_NOT_FOUND:
      'Conta do Instagram não encontrada. Verifique o nome de usuário.',
    STORY_NO_ACTIVE:
      'Nenhum story ativo encontrado para esta conta (os stories expiram após 24 h).',
    STORY_RATE_LIMITED:
      'Limite por hora atingido para listar stories. Tente novamente mais tarde.',
  },
  de: {
    STORIES_UNAVAILABLE: 'Stories sind vorübergehend nicht verfügbar.',
    STORY_ACCOUNT_PRIVATE:
      'Dieses Instagram-Konto ist privat. Nur Stories öffentlicher Konten können abgerufen werden.',
    STORY_ACCOUNT_NOT_FOUND:
      'Instagram-Konto nicht gefunden. Bitte prüfe den Benutzernamen.',
    STORY_NO_ACTIVE:
      'Keine aktiven Stories für dieses Konto gefunden (Stories laufen nach 24 Std. ab).',
    STORY_RATE_LIMITED:
      'Stündliches Limit für das Laden von Stories erreicht. Bitte versuche es später erneut.',
  },
  tr: {
    STORIES_UNAVAILABLE: 'Hikayeler geçici olarak kullanılamıyor.',
    STORY_ACCOUNT_PRIVATE:
      'Bu Instagram hesabı gizlidir. Yalnızca herkese açık hesapların hikayeleri görüntülenebilir.',
    STORY_ACCOUNT_NOT_FOUND:
      'Instagram hesabı bulunamadı. Kullanıcı adını kontrol edin.',
    STORY_NO_ACTIVE:
      'Bu hesap için aktif hikaye bulunamadı (hikayeler 24 saat sonra silinir).',
    STORY_RATE_LIMITED:
      'Hikayeleri yükleme saatlik sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.',
  },
  id: {
    STORIES_UNAVAILABLE: 'Story sementara tidak tersedia.',
    STORY_ACCOUNT_PRIVATE:
      'Akun Instagram ini bersifat privat. Hanya story dari akun publik yang dapat dilihat.',
    STORY_ACCOUNT_NOT_FOUND:
      'Akun Instagram tidak ditemukan. Periksa kembali nama pengguna.',
    STORY_NO_ACTIVE:
      'Tidak ada story aktif untuk akun ini (story menghilang setelah 24 jam).',
    STORY_RATE_LIMITED:
      'Batas per jam untuk memuat story telah tercapai. Silakan coba lagi nanti.',
  },
  it: {
    STORIES_UNAVAILABLE: 'Le storie non sono temporaneamente disponibili.',
    STORY_ACCOUNT_PRIVATE:
      'Questo account Instagram è privato. È possibile consultare solo le storie di account pubblici.',
    STORY_ACCOUNT_NOT_FOUND:
      'Account Instagram non trovato. Controlla il nome utente.',
    STORY_NO_ACTIVE:
      'Nessuna storia attiva trovata per questo account (le storie scompaiono dopo 24 ore).',
    STORY_RATE_LIMITED:
      'Limite orario raggiunto per il caricamento delle storie. Riprova più tardi.',
  },
  ru: {
    STORIES_UNAVAILABLE: 'Истории временно недоступны.',
    STORY_ACCOUNT_PRIVATE:
      'Этот аккаунт Instagram закрыт. Доступны только истории публичных аккаунтов.',
    STORY_ACCOUNT_NOT_FOUND:
      'Аккаунт Instagram не найден. Проверьте имя пользователя.',
    STORY_NO_ACTIVE:
      'У этого аккаунта нет активных историй (истории исчезают через 24 ч).',
    STORY_RATE_LIMITED:
      'Достигнут часовой лимит загрузки историй. Попробуйте позже.',
  },
};

export async function fetchAccountStories(
  username: string,
  language: LanguageCode = 'fr',
  options?: {
    linkedStoryId?: string;
    sourceUrl?: string;
  }
): Promise<CarouselMediaResult> {
  const cleanUser = (username || '').trim().replace(/^@+/, '').toLowerCase();
  const url = resolveApiUrl(
    `/api/stories?username=${encodeURIComponent(cleanUser)}`
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new ExtractionError(
      getLocalizedErrorMessage('NETWORK_ERROR', language, {
        platform: 'instagram',
        isStory: true,
      }),
      'NETWORK_ERROR'
    );
  }

  const data: any = await response.json().catch(() => null);
  if (!data || !data.ok || data.error) {
    const errCode = data?.error?.code || 'STORIES_UNAVAILABLE';
    const localized = getLocalizedErrorMessage(errCode, language, {
      platform: 'instagram',
      isStory: true,
      mediaType: 'story',
      serverMessage: data?.error?.message,
    });
    throw new ExtractionError(localized, errCode);
  }

  const rawItems: any[] = Array.isArray(data.items) ? data.items : [];
  const linkedId = options?.linkedStoryId ? String(options.linkedStoryId) : null;
  const hasLinkedMatch =
    Boolean(linkedId) && rawItems.some((it) => String(it.id) === linkedId);

  const items: CarouselSlideItem[] = rawItems.map((it, idx) => {
    const itemId = String(it.id || idx + 1);
    const isVideo = it.kind === 'video';
    const width = typeof it.width === 'number' ? it.width : undefined;
    const height = typeof it.height === 'number' ? it.height : undefined;
    return {
      id: `story-${itemId}-${idx + 1}`,
      index: typeof it.index === 'number' ? it.index : idx + 1,
      mediaType: isVideo ? 'video' : 'image',
      quality: String(it.quality || (isVideo ? '1080p' : 'HD')),
      width,
      height,
      dimensions: width && height ? `${width} × ${height}` : undefined,
      date: typeof it.taken_at === 'string' ? it.taken_at : undefined,
      selected: hasLinkedMatch ? itemId === linkedId : undefined,
      label: 'story',
      thumbnailUrl: resolveApiUrl(it.thumbnail || it.url),
      downloadUrl: resolveApiUrl(it.url),
    };
  });

  const resolvedUser = String(data.author?.username || data.username || cleanUser).replace(
    /^@/,
    ''
  );
  const creatorHandle = `@${resolvedUser}`;
  const creatorName = data.author?.full_name || creatorHandle;

  return {
    id: `stories-${resolvedUser}-${Date.now()}`,
    payloadType: 'carousel',
    platform: 'instagram',
    badgeLabel: `Instagram Stories (${creatorHandle})`,
    sourceUrl:
      options?.sourceUrl || `https://www.instagram.com/stories/${resolvedUser}/`,
    creatorHandle,
    creatorName,
    verified: Boolean(data.author?.verified),
    extractedAt: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
    caption: creatorHandle,
    totalItems: items.length,
    selectionContext: 'story',
    items,
  };
}

const LINKEDIN_RETRYABLE_ERROR_CODES = new Set<string>([
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK_ERROR',
  'IMAGE_EXPIRED',
]);

const LINKEDIN_NON_RETRYABLE_ERROR_CODES = new Set<string>([
  'LOGIN_WALL',
  'PROFILE_NOT_FOUND',
  'PHOTO_NOT_AVAILABLE',
  'INVALID_IMAGE',
]);

export function shouldShowRetryButton(
  platform: string | null | undefined,
  errorCode: string | null | undefined
): boolean {
  if (platform === 'linkedin') {
    if (!errorCode) return false;
    if (LINKEDIN_NON_RETRYABLE_ERROR_CODES.has(errorCode)) return false;
    return LINKEDIN_RETRYABLE_ERROR_CODES.has(errorCode);
  }
  return true;
}

