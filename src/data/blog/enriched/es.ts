import type { BlogArticleTranslation } from '../../blogArticles.ts';

/**
 * Enriched Spanish (ES) translations for previously thin published blog articles.
 * Slugs and original publishedAt dates are preserved verbatim; updatedAt is set to 2026-11-22.
 */
export const ES_ENRICHED_BLOG_TRANSLATIONS: Record<string, BlogArticleTranslation> = {
  'instagram-reels-carousels-resolution-compression-guide': {
    locale: 'es',
    localizedSlug: 'reel-instagram-descargado-sin-audio',
    translationStatus: 'published',
    publishedAt: '2026-02-14',
    updatedAt: '2026-11-22',
    title: '¿Reel de Instagram descargado sin sonido? Por qué ocurre y solución',
    excerpt:
      'Por qué un Reel de Instagram guardado se reproduce en silencio: pistas MPEG-DASH separadas, licencias musicales, códecs AAC y cómo comprobar el MP4 con audio.',
    metaTitle: 'Reel de Instagram descargado sin sonido: causas y solución',
    metaDescription:
      '¿Tu Reel de Instagram descargado no tiene audio? Aprende cómo funcionan las pistas MPEG-DASH, los bloqueos de música y cómo guardar el MP4 con sonido.',
    primaryKeyword: 'reel instagram descargado sin sonido',
    secondaryKeywords: [
      'video instagram sin audio',
      'descargar reel instagram con sonido',
      'instagram reel sin musica al guardar',
      'mpeg dash audio instagram mp4',
    ],
    searchIntent:
      'Guía práctica y técnica para diagnosticar y resolver Reels públicos de Instagram descargados sin pista de audio.',
    readingTimeMinutes: 7,
    quickAnswer:
      'Un Reel de Instagram descargado suele quedar sin sonido porque la web entrega vídeo y audio en pistas MPEG-DASH separadas o porque Instagram silenció la música por derechos regionales. Comprueba el sonido en una pestaña privada sin sesión y descarga de nuevo el archivo MP4 combinado mediante VIDNEX.',
    keyTakeaways: [
      'En el navegador, Instagram separa a menudo la pista de vídeo (H.264/VP9) de la pista de audio (AAC) mediante MPEG-DASH.',
      'La música añadida desde la biblioteca oficial puede quedar silenciada según el país o la licencia vigente.',
      'Algunos reproductores o editores no decodifican bien el audio AAC aunque el archivo MP4 sí lo incluya.',
      'VIDNEX procesa únicamente publicaciones públicas sin registro ni almacenamiento permanente de archivos.',
    ],
    introduction: [
      'Descargas un Reel público de Instagram, abres el archivo MP4 en tu móvil o en el ordenador y la imagen se ve perfectamente, pero no se escucha absolutamente nada. Este problema es uno de los más habituales al guardar vídeos de redes sociales y casi nunca se debe a un fallo del altavoz ni del volumen del teléfono.',
      'El origen está en la arquitectura de vídeo de Instagram, en las reglas de licencias musicales por país y en cómo cada reproductor interpreta las pistas de audio AAC. En esta guía analizamos las causas reales de los Reels sin sonido, te mostramos una tabla rápida de diagnóstico y repasamos los pasos concretos para comprobar y descargar archivos MP4 públicos con audio sincronizado.',
    ],
    tableOfContents: [
      {
        id: 'pistas-separadas-mpeg-dash-instagram',
        heading: '1. Cómo separa Instagram el vídeo y el audio con MPEG-DASH',
      },
      {
        id: 'bloqueos-musicales-y-audio-original',
        heading: '2. Restricciones de música con licencia frente al audio original',
      },
      {
        id: 'tabla-diagnostico-reel-sin-sonido',
        heading: '3. Tabla de diagnóstico: causas habituales y solución recomendada',
      },
      {
        id: 'pasos-para-comprobar-y-guardar-reel-con-audio',
        heading: '4. Pasos para comprobar y descargar un Reel público con sonido',
      },
      {
        id: 'problemas-de-reproductor-y-codec-en-movil-y-pc',
        heading: '5. Descartar fallos del reproductor o del códec en iPhone, Android y PC',
      },
      {
        id: 'alcance-de-vidnex-y-derechos-de-autor',
        heading: '6. Límites técnicos de VIDNEX, privacidad y derechos de autor',
      },
    ],
    content: [
      {
        id: 'pistas-separadas-mpeg-dash-instagram',
        heading: '1. Cómo separa Instagram el vídeo y el audio con MPEG-DASH',
        paragraphs: [
          'Para adaptar la calidad a la velocidad de tu conexión y reducir el consumo de datos, Instagram utiliza transmisión adaptativa basada en MPEG-DASH. En lugar de enviar siempre un único archivo cerrado, el servidor almacena varias versiones de la imagen (en H.264 o VP9) por un lado y la pista de sonido (habitualmente AAC-LC) en un archivo independiente. El reproductor oficial de Instagram sincroniza ambas pistas en tiempo real mientras ves el Reel.',
          'Cuando una extensión básica del navegador o una herramienta anticuada captura solo la primera URL de vídeo que aparece en la red, el archivo resultante contiene únicamente el flujo visual sin ninguna pista de audio multiplexada. Por eso el archivo tiene extensión .mp4, pesa varios megabytes y reproduce el vídeo en silencio absoluto. VIDNEX analiza los metadatos públicos del Reel para localizar el flujo progresivo MP4 combinado siempre que la publicación pública lo exponga con sonido.',
        ],
        technicalCallout: {
          label: 'Dato técnico clave',
          text: 'Un contenedor MP4 progresivo combina el flujo de vídeo (avc1) y el flujo de audio (mp4a.40.2 / AAC) dentro del mismo archivo, evitando desincronizaciones al reproducirlo en iOS, Android, Windows o macOS.',
        },
      },
      {
        id: 'bloqueos-musicales-y-audio-original',
        heading: '2. Restricciones de música con licencia frente al audio original',
        paragraphs: [
          'En otras ocasiones el archivo descargado carece de sonido porque la pista musical ya no está disponible en los servidores de Meta. Instagram permite añadir canciones comerciales desde su biblioteca interna, pero esas licencias cambian según el territorio y la duración del acuerdo con cada discográfica. Si el acuerdo expira o no cubre el acceso web sin inicio de sesión, Instagram silencia el clip o muestra el aviso «Audio no disponible».',
          'Existe una diferencia importante entre el audio original grabado directamente por el creador dentro del vídeo y una pista musical superpuesta desde la biblioteca de Reels. El audio original forma parte del archivo base del vídeo público y suele mantenerse intacto, salvo que el propio autor haya subido el vídeo sin sonido. En cambio, cuando una canción comercial está bloqueada en origen, ninguna herramienta externa puede reconstruir un audio que el servidor de Instagram no envía.',
        ],
        bullets: [
          'Abre el enlace del Reel en una ventana de incógnito sin iniciar sesión para verificar qué sirve Instagram públicamente.',
          'Pulsa el icono del altavoz en el reproductor web, ya que los navegadores silencian por defecto la reproducción automática.',
          'Comprueba si la publicación es realmente un vídeo o un carrusel de fotos con música asociada, donde imagen y sonido no forman un único archivo MP4.',
        ],
      },
      {
        id: 'tabla-diagnostico-reel-sin-sonido',
        heading: '3. Tabla de diagnóstico: causas habituales y solución recomendada',
        paragraphs: [
          'Consulta esta tabla comparativa para identificar rápidamente si la ausencia de sonido proviene del enlace, de una restricción de la plataforma o de la configuración de tu dispositivo.',
        ],
        table: {
          headers: ['Síntoma detectado', 'Causa más probable', 'Solución práctica'],
          rows: [
            [
              'Se oye en Instagram, pero el MP4 guardado está mudo',
              'Se descargó una pista de vídeo DASH sin audio multiplexado',
              'Pegar el enlace público en VIDNEX y descargar el MP4 combinado disponible',
            ],
            [
              'No se oye en Instagram en modo incógnito',
              'Música silenciada por licencia regional o vídeo subido sin audio',
              'Limitación en origen; no es posible recuperar audio ausente del servidor',
            ],
            [
              'Sin sonido solo en un editor de vídeo o reproductor antiguo',
              'Incompatibilidad parcial con el perfil AAC-LC o tasa de muestreo',
              'Probar el archivo en VLC, QuickTime o la galería nativa del teléfono',
            ],
            [
              'Archivo incompleto o error al guardar desde móvil',
              'Descarga lanzada en navegador integrado de mensajería o enlace caducado',
              'Copiar de nuevo el enlace y abrir VIDNEX en Safari, Chrome o Firefox',
            ],
            [
              'Carrusel de fotografías descargado sin canción de fondo',
              'Los carruseles de fotos almacenan imágenes JPG/WebP sin pista de vídeo',
              'Verificar si el elemento concreto es una diapositiva de vídeo o una foto fija',
            ],
          ],
        },
      },
      {
        id: 'pasos-para-comprobar-y-guardar-reel-con-audio',
        heading: '4. Pasos para comprobar y descargar un Reel público con sonido',
        paragraphs: [
          'Sigue este orden de verificación para evitar descargas repetidas y confirmar desde el primer momento que el archivo público conserva su audio.',
        ],
        orderedSteps: [
          'Abre el Reel público en Instagram, pulsa el botón de compartir y selecciona «Copiar enlace» para obtener la URL limpia de la publicación.',
          'Pega esa dirección en una pestaña privada del navegador sin sesión iniciada y activa el icono de sonido para comprobar que el vídeo y el audio se reproducen con normalidad.',
          'Abre el descargador de Instagram de VIDNEX directamente desde Safari, Chrome, Firefox o Edge, evitando navegadores internos de WhatsApp, Telegram o la propia app.',
          'Introduce el enlace en el campo principal y ejecuta el análisis para obtener el archivo MP4 público disponible.',
          'Guarda el archivo en tu dispositivo y reprodúcelo de inmediato desde la galería o la app Archivos con el interruptor de silencio desactivado.',
        ],
        proTip:
          'En iPhone y iPad, el interruptor lateral de silencio puede silenciar la vista previa en ciertas aplicaciones aunque el volumen multimedia esté alto. Desactiva el modo silencio o sube el volumen antes de descartar un archivo.',
      },
      {
        id: 'problemas-de-reproductor-y-codec-en-movil-y-pc',
        heading: '5. Descartar fallos del reproductor o del códec en iPhone, Android y PC',
        paragraphs: [
          'A veces el archivo MP4 sí incluye perfectamente la pista de sonido, pero la aplicación con la que intentas verlo no la reproduce. Esto ocurre con reproductores antiguos de Windows, navegadores con pestañas silenciadas o ciertos editores de vídeo que exigen formatos de audio específicos y omiten pistas AAC con perfiles móviles.',
          'La comprobación más fiable consiste en abrir el archivo en VLC Media Player (disponible en Windows, macOS, Android e iOS) o en la app Fotos / Archivos nativa de tu teléfono. En VLC, dentro de «Información del códec», verás al instante si existe un flujo de vídeo y un segundo flujo de audio (normalmente MPEG AAC Audio, mp4a). Si el flujo de audio aparece listado, el archivo está sano y solo debes revisar la salida de sonido, unos auriculares Bluetooth conectados o cambiar de reproductor.',
        ],
      },
      {
        id: 'alcance-de-vidnex-y-derechos-de-autor',
        heading: '6. Límites técnicos de VIDNEX, privacidad y derechos de autor',
        paragraphs: [
          'VIDNEX funciona íntegramente desde el navegador sin exigir cuenta ni contraseña y procesa únicamente publicaciones de acceso público. No accede a perfiles privados, historias restringidas a Mejores Amigos ni contenidos protegidos tras un muro de inicio de sesión. Tampoco almacena copias permanentes de los vídeos en sus servidores: el flujo se entrega directamente a tu navegador para que puedas guardarlo localmente.',
          'Recuerda que tanto las imágenes como las voces y canciones incluidas en un Reel pertenecen a sus respectivos creadores y titulares de derechos. Utiliza los archivos públicos descargados únicamente para respaldo de contenido propio, consulta personal permitida o con autorización expresa del titular, evitando republicar obras ajenas sin permiso.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Por qué un Reel tiene sonido en Instagram pero el MP4 descargado queda mudo?',
        answer:
          'Instagram suele servir vídeo y audio por separado mediante MPEG-DASH en navegadores web. Si una extensión básica solo descarga el flujo visual, el archivo MP4 resultante carece de pista de sonido. Comprueba el enlace público en incógnito y utiliza VIDNEX para obtener el archivo MP4 combinado disponible.',
      },
      {
        question: '¿Puede VIDNEX recuperar la música de un Reel silenciado por derechos de autor?',
        answer:
          'No. Cuando Instagram silencia o retira una pista musical por restricciones territoriales o derechos de autor, el servidor público de la plataforma deja de entregar ese audio. VIDNEX extrae únicamente el contenido tal como está publicado y no sustituye ni desbloquea pistas restringidas.',
      },
      {
        question: '¿Cómo sé si mi archivo MP4 realmente contiene una pista de audio interna?',
        answer:
          'Abre el vídeo en VLC Media Player y entra en la sección de información del códec para comprobar si aparece una pista MPEG AAC (mp4a) junto al vídeo. También puedes probar el archivo en la galería nativa del móvil comprobando que no haya auriculares Bluetooth conectados ni modo silencio activo.',
      },
      {
        question: '¿Funciona la descarga con audio para Reels de cuentas privadas de Instagram?',
        answer:
          'No. VIDNEX solo procesa publicaciones públicas que cualquier persona puede abrir en el navegador sin iniciar sesión. Por respeto a la privacidad y a los límites técnicos de la plataforma, los Reels de perfiles privados o compartidos solo con seguidores aprobados no se pueden analizar ni descargar.',
      },
      {
        question: '¿Qué formato ofrece mayor compatibilidad para reproducir Reels con sonido en cualquier dispositivo?',
        answer:
          'El formato más compatible es un contenedor MP4 estándar con vídeo H.264 y audio AAC-LC. Se reproduce de forma nativa en iPhone, iPad, Android, Windows y macOS sin instalar códecs adicionales, tanto en la app Archivos como en las galerías de fotos y la mayoría de editores modernos.',
      },
    ],
    ctaTitle: 'Comprueba tu Reel público de Instagram con audio',
    ctaDescription:
      'Pega el enlace de un Reel público en la herramienta de Instagram de VIDNEX para analizar y descargar el archivo MP4 disponible sin registro.',
    ctaButtonLabel: 'Abrir herramienta de Instagram',
    internalLinks: [
      {
        label: 'Descargador de Reels de Instagram VIDNEX',
        description:
          'Guarda Reels y vídeos públicos de Instagram en formato MP4 con el audio disponible.',
        targetType: 'platform',
        platformKey: 'instagram',
      },
      {
        label: 'Dónde van los vídeos descargados en iPhone y iPad',
        description:
          'Encuentra tus archivos MP4 en la app Archivos de Apple y pásalos a Fotos.',
        targetType: 'blog_article',
        targetArticleId: 'how-to-download-videos-on-iphone',
      },
      {
        label: '¿Por qué no se descarga un vídeo de TikTok?',
        description:
          'Diagnóstico completo de enlaces expirados, cuentas privadas y bloqueos de navegador.',
        targetType: 'blog_article',
        targetArticleId: 'troubleshooting-expired-blocked-social-media-links',
      },
    ],
    sources: [
      {
        title: 'Servicio de ayuda de Instagram — Música y audio en Reels',
        publisher: 'Instagram / Meta',
        url: 'https://help.instagram.com/402084904469945',
      },
      {
        title: 'IETF RFC 6381 — The Codecs and Profiles Parameters for Media Types',
        publisher: 'IETF RFC Editor',
        url: 'https://www.rfc-editor.org/rfc/rfc6381',
      },
    ],
  },

  'troubleshooting-expired-blocked-social-media-links': {
    locale: 'es',
    localizedSlug: 'por-que-no-se-descarga-video-tiktok',
    translationStatus: 'published',
    publishedAt: '2026-02-10',
    updatedAt: '2026-11-22',
    title: '¿Por qué no se descarga mi vídeo de TikTok? 7 causas y soluciones',
    excerpt:
      'Soluciona fallos al descargar vídeos públicos de TikTok: privacidad del creador, enlaces cortos vm.tiktok.com, modo foto, firmas CDN caducadas y bloqueos móviles.',
    metaTitle: '¿Por qué no se descarga un vídeo de TikTok? 7 soluciones',
    metaDescription:
      'Descubre las 7 causas por las que un vídeo de TikTok no se descarga y cómo solucionar errores de enlaces vm.tiktok.com, privacidad y móvil.',
    primaryKeyword: 'por que no se descarga video tiktok',
    secondaryKeywords: [
      'no puedo descargar video de tiktok',
      'error enlace tiktok',
      'guardar tiktok publico mp4',
      'enlace vm tiktok caducado',
    ],
    searchIntent:
      'Guía de resolución de errores para usuarios que no logran descargar un vídeo de TikTok desde la app o desde el navegador.',
    readingTimeMinutes: 7,
    quickAnswer:
      'Un vídeo de TikTok no se descarga habitualmente porque la cuenta es privada, el enlace se copió con texto adicional, el token temporal del servidor CDN caducó o un navegador integrado bloquea el archivo. Verifica el enlace en modo incógnito y vuelve a analizarlo en Safari, Chrome o Firefox.',
    keyTakeaways: [
      'Las cuentas privadas, vídeos solo para amigos o con restricción de edad no exponen ningún flujo público.',
      'Los enlaces cortos vm.tiktok.com o vt.tiktok.com deben pegarse limpios, sin frases añadidas por apps de mensajería.',
      'Las URLs firmadas de los servidores CDN expiran con el tiempo: basta con volver a analizar el enlace original.',
      'Los navegadores integrados en redes sociales suelen bloquear descargas; usa siempre el navegador nativo del sistema.',
    ],
    introduction: [
      'Cuando intentas guardar un vídeo de TikTok y la descarga falla o el botón ni siquiera responde, rara vez existe una única explicación. Cada enlace compartido recorre varias etapas técnicas antes de llegar a tu dispositivo: redirección desde un dominio corto (`vm.tiktok.com` o `vt.tiktok.com`), comprobación de privacidad de la cuenta, permisos configurados por el creador, reglas regionales y firmas temporales del servidor multimedia.',
      'En esta guía reunimos las siete causas reales por las que un vídeo de TikTok no se descarga —tanto dentro de la aplicación oficial como al usar una herramienta web— junto con una tabla de diagnóstico inmediato y una lista ordenada de comprobaciones para resolver el fallo en menos de un minuto.',
    ],
    tableOfContents: [
      {
        id: 'descargas-desactivadas-y-cuentas-privadas',
        heading: '1. Botón desactivado en la app frente a cuentas privadas o restringidas',
      },
      {
        id: 'enlaces-cortos-mal-copiados-y-modo-foto',
        heading: '2. Enlaces cortos incompletos, texto añadido y presentaciones en Modo Foto',
      },
      {
        id: 'tabla-siete-causas-y-soluciones-tiktok',
        heading: '3. Tabla de diagnóstico: las 7 causas más comunes y cómo resolverlas',
      },
      {
        id: 'tokens-cdn-caducados-y-navegadores-integrados',
        heading: '4. Tokens CDN caducados, navegadores integrados y espacio en el móvil',
      },
      {
        id: 'pasos-para-solucionar-el-error-de-descarga',
        heading: '5. Lista de verificación paso a paso cuando falla un enlace de TikTok',
      },
      {
        id: 'uso-publico-limites-y-derechos-de-autor',
        heading: '6. Contenidos públicos, límites de VIDNEX y respeto a los derechos de autor',
      },
    ],
    content: [
      {
        id: 'descargas-desactivadas-y-cuentas-privadas',
        heading: '1. Botón desactivado en la app frente a cuentas privadas o restringidas',
        paragraphs: [
          'Dentro de los ajustes de privacidad de TikTok, cualquier creador puede desactivar la opción «Descargas de vídeo». Cuando ese interruptor está apagado, la aplicación oficial oculta el botón «Guardar vídeo» en el menú de compartir. Sin embargo, si el perfil y la publicación siguen siendo públicos y visibles para cualquier visitante sin iniciar sesión, el flujo multimedia público continúa disponible para su reproducción en navegadores web.',
          'El caso cambia por completo cuando la cuenta es privada, el vídeo está limitado a «Solo amigos» o «Solo yo», fue eliminado por el autor o exige verificación de mayoría de edad. En esos escenarios los servidores de TikTok exigen una sesión autenticada con permisos específicos. VIDNEX opera exclusivamente sin inicio de sesión y no solicita ni utiliza cookies personales, por lo que los contenidos privados o restringidos no se pueden extraer.',
        ],
        technicalCallout: {
          label: 'Prueba rápida de visibilidad',
          text: 'Abre el enlace de TikTok en una pestaña privada (incógnito) sin iniciar sesión. Si el vídeo se reproduce con normalidad, es público; si pide iniciar sesión o indica que no está disponible, tiene bloqueo de privacidad o edad.',
        },
      },
      {
        id: 'enlaces-cortos-mal-copiados-y-modo-foto',
        heading: '2. Enlaces cortos incompletos, texto añadido y presentaciones en Modo Foto',
        paragraphs: [
          'Uno de los errores más frecuentes ocurre al compartir un vídeo desde WhatsApp, Telegram o la propia app móvil: al copiar el mensaje completo se arrastran frases como «Mira este vídeo https://vm.tiktok.com/...» o signos de puntuación finales. También es habitual copiar por error la dirección del perfil (`tiktok.com/@usuario`) en lugar del enlace directo de la publicación que contiene `/video/` seguido del identificador numérico.',
          'Otra fuente habitual de confusión es el Modo Foto de TikTok. Muchas publicaciones muestran diapositivas de imágenes acompañadas de música y parecen vídeos convencionales al deslizar el feed, pero técnicamente se componen de imágenes independientes más una pista de audio separada. Cuando ocurre esto, no existe un flujo MP4 clásico único y conviene comprobar los elementos multimedia o el audio público expuesto por la publicación.',
        ],
      },
      {
        id: 'tabla-siete-causas-y-soluciones-tiktok',
        heading: '3. Tabla de diagnóstico: las 7 causas más comunes y cómo resolverlas',
        paragraphs: [
          'Utiliza esta tabla para identificar en segundos qué está bloqueando tu descarga y qué acción concreta aplicar en cada caso.',
        ],
        table: {
          headers: ['Causa del fallo', 'Síntoma habitual', 'Solución concreta'],
          rows: [
            [
              '1. Creador desactivó descargas en la app',
              'No aparece el botón Guardar vídeo en TikTok',
              'Copiar el enlace público y analizarlo desde el navegador en VIDNEX',
            ],
            [
              '2. Cuenta privada o publicación para amigos',
              'Aviso de vídeo no disponible al abrir sin sesión',
              'No descargable; respetar la privacidad del perfil (solo contenido público)',
            ],
            [
              '3. Enlace truncado o con texto extra',
              'Error de formato de URL o enlace de perfil',
              'Usar Compartir → Copiar enlace y pegar únicamente la dirección https://',
            ],
            [
              '4. Publicación en Modo Foto (carrusel)',
              'No aparece una pista MP4 estándar de vídeo',
              'Comprobar las imágenes públicas o la pista de audio disponible',
            ],
            [
              '5. Firma temporal CDN caducada',
              'Error 403 o fallo tras dejar la pestaña abierta mucho rato',
              'Volver a pegar la URL original para generar una firma de descarga nueva',
            ],
            [
              '6. Navegador integrado o almacenamiento lleno',
              'El botón no inicia la descarga o se detiene al 99 %',
              'Abrir en Safari, Chrome o Firefox y liberar al menos 200 MB de espacio',
            ],
            [
              '7. Bloqueo por edad o restricción regional',
              'TikTok solicita iniciar sesión para confirmar edad o país',
              'Restricción en el servidor de origen; no existe acceso público externo',
            ],
          ],
        },
      },
      {
        id: 'tokens-cdn-caducados-y-navegadores-integrados',
        heading: '4. Tokens CDN caducados, navegadores integrados y espacio en el móvil',
        paragraphs: [
          'Los servidores de distribución de TikTok protegen los enlaces directos de archivo mediante parámetros temporales (`x-expires`, `x-signature`) que suelen caducar entre quince y sesenta minutos después de la consulta. Si analizas un vídeo, dejas la pestaña en segundo plano durante una hora y luego pulsas descargar, el servidor rechazará la petición. Basta con recargar y analizar de nuevo el enlace original para obtener una dirección válida.',
          'En móviles iOS y Android, otro bloqueo habitual proviene de los navegadores integrados dentro de aplicaciones de mensajería o redes sociales. Esos entornos restringidos suelen ignorar la cabecera HTTP `Content-Disposition: attachment` que indica al navegador que debe guardar el archivo. Abre siempre la página en Safari, Chrome, Firefox o Edge, mantén la app en primer plano hasta completar el guardado y asegúrate de tener suficiente espacio libre en el almacenamiento interno.',
        ],
      },
      {
        id: 'pasos-para-solucionar-el-error-de-descarga',
        heading: '5. Lista de verificación paso a paso cuando falla un enlace de TikTok',
        paragraphs: [
          'Antes de rendirte con un enlace público de TikTok, ejecuta estas cinco comprobaciones en orden: solucionan la gran mayoría de los errores técnicos.',
        ],
        orderedSteps: [
          'Vuelve a la publicación en TikTok, pulsa «Compartir» y elige «Copiar enlace» para obtener una URL completa sin cortes ni comentarios adicionales.',
          'Abre una ventana privada en tu navegador y pega el enlace para confirmar que el vídeo es público y se reproduce sin pedir inicio de sesión.',
          'Si estabas dentro de un navegador integrado de WhatsApp, Telegram o Instagram, abre VIDNEX directamente en Safari, Chrome, Firefox o Edge.',
          'Pega el enlace limpio en el descargador de TikTok de VIDNEX y vuelve a ejecutar la extracción para renovar cualquier firma CDN que haya caducado.',
          'En teléfono móvil, verifica que dispones de espacio libre suficiente y mantén el navegador en primer plano hasta ver el aviso de descarga completada.',
        ],
        proTip:
          'Si una red Wi-Fi escolar o corporativa bloquea el dominio corto vm.tiktok.com, abre primero el enlace en el navegador para obtener la URL larga con /video/ y pégala directamente en el analizador.',
      },
      {
        id: 'uso-publico-limites-y-derechos-de-autor',
        heading: '6. Contenidos públicos, límites de VIDNEX y respeto a los derechos de autor',
        paragraphs: [
          'VIDNEX analiza únicamente enlaces públicos de TikTok, Instagram, X (Twitter), Facebook y fotos de perfil públicas de LinkedIn, además de ofrecer una herramienta local para dividir imágenes directamente en tu navegador. No solicita cuentas ni contraseñas, no guarda archivos permanentemente en servidores propios y no admite plataformas como YouTube ni Snapchat.',
          'Recuerda respetar siempre los derechos de autor y las normas de cada comunidad. Guarda únicamente vídeos propios o contenidos públicos para consulta personal autorizada o con permiso expreso del creador, y evita redistribuir material ajeno sin consentimiento.',
        ],
      },
    ],
    faq: [
      {
        question: '¿Por qué aparece el mensaje «Vídeo no disponible» al pegar un enlace de TikTok?',
        answer:
          'Este error indica que el creador borró el vídeo, cambió su cuenta a privada, limitó la audiencia a sus amigos o activó una restricción de edad. En esos casos TikTok no entrega ningún flujo público al exterior y ninguna herramienta web sin sesión puede descargarlo.',
      },
      {
        question: '¿Por qué la descarga de un vídeo de TikTok se detiene al 99 % en el móvil?',
        answer:
          'Las interrupciones al final suelen deberse a cambiar de aplicación mientras el navegador escribe el archivo, a falta de espacio de almacenamiento o a una firma temporal caducada. Mantén Safari o Chrome en primer plano, libera espacio y vuelve a analizar el enlace original.',
      },
      {
        question: '¿Acepta VIDNEX enlaces cortos como vm.tiktok.com y vt.tiktok.com?',
        answer:
          'Sí. VIDNEX resuelve automáticamente las redirecciones oficiales de vm.tiktok.com y vt.tiktok.com hacia la publicación pública correspondiente sin pasos manuales extra. Solo asegúrate de pegar únicamente la URL completa y limpia, sin texto de acompañamiento ni signos añadidos al copiar el mensaje desde otra aplicación.',
      },
      {
        question: '¿Por qué falla la descarga si abro el enlace desde WhatsApp o Telegram?',
        answer:
          'Los navegadores integrados dentro de aplicaciones de mensajería y redes sociales suelen bloquear por seguridad las descargas directas de archivos MP4 locales. Pulsa el menú superior de opciones y elige «Abrir en Chrome» o «Abrir en Safari» para guardar el vídeo normalmente en tu teléfono.',
      },
      {
        question: '¿Se puede descargar el audio si la publicación de TikTok es un carrusel de fotos?',
        answer:
          'Sí, siempre que la publicación sea pública y exponga su pista sonora en los metadatos públicos de la página. En ese escenario VIDNEX permite acceder a la pista de audio original disponible en MP3 o M4A aunque la publicación no sea un vídeo MP4 tradicional.',
      },
    ],
    ctaTitle: 'Vuelve a probar tu enlace público de TikTok',
    ctaDescription:
      'Pega tu URL limpia de TikTok en VIDNEX para comprobar el estado del vídeo público y guardar el archivo MP4 o audio disponible.',
    ctaButtonLabel: 'Abrir herramienta de TikTok',
    internalLinks: [
      {
        label: 'Descargador de Vídeos y Audio de TikTok VIDNEX',
        description:
          'Guarda vídeos públicos de TikTok en MP4 sin marca de agua o extrae la pista de audio disponible.',
        targetType: 'platform',
        platformKey: 'tiktok',
      },
      {
        label: 'Guardar vídeos públicos de TikTok sin marca de agua',
        description:
          'Guía paso a paso para guardar vídeos públicos de TikTok en móvil y ordenador.',
        targetType: 'blog_article',
        targetArticleId: 'save-public-tiktok-videos-without-watermark-guide',
      },
      {
        label: '¿Reel de Instagram descargado sin sonido? Causas y solución',
        description:
          'Descubre por qué algunos Reels públicos se guardan sin pista de audio AAC y cómo comprobarlo.',
        targetType: 'blog_article',
        targetArticleId: 'instagram-reels-carousels-resolution-compression-guide',
      },
    ],
    sources: [
      {
        title: 'Centro de ayuda de TikTok — Descargas de vídeos',
        publisher: 'TikTok Support',
        url: 'https://support.tiktok.com/es/using-tiktok/creating-videos/video-downloads',
      },
      {
        title: 'MDN Web Docs — Content-Disposition HTTP Header',
        publisher: 'Mozilla Developer Network',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition',
      },
    ],
  },
};
