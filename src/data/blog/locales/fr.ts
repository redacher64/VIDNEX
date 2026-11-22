import type { BlogArticleTranslation } from '../../blogArticles.ts';

export const FR_BLOG_TRANSLATIONS: Record<string, BlogArticleTranslation> = {
  'how-to-download-videos-on-iphone': {
    locale: 'fr',
    localizedSlug: 'ou-vont-les-videos-telechargees-iphone',
    translationStatus: 'published',
    publishedAt: '2026-11-22',
    updatedAt: '2026-11-22',
    title: 'Où vont les vidéos téléchargées sur iPhone et iPad (app Fichiers) ?',
    excerpt:
      'Retrouvez vos vidéos MP4 téléchargées depuis Safari ou Chrome dans l’app Fichiers d’iOS, enregistrez-les dans Photos et résolvez les blocages courants sur iPhone et iPad.',
    metaTitle: 'Où vont les vidéos téléchargées sur iPhone et iPad ?',
    metaDescription:
      'Retrouvez facilement vos vidéos MP4 téléchargées sur iPhone et iPad dans l’app Fichiers, transférez-les vers Photos et corrigez les blocages Safari.',
    primaryKeyword: 'ou vont les videos telechargees sur iphone',
    secondaryKeywords: [
      'trouver telechargements iphone app fichiers',
      'enregistrer video safari dans photos iphone',
      'video mp4 telechargee introuvable iphone',
      'dossier telechargements ipad safari',
    ],
    searchIntent:
      'Guide pratique pour retrouver une vidéo publique téléchargée depuis le navigateur sur iPhone ou iPad et l’ajouter à la photothèque Apple Photos.',
    readingTimeMinutes: 7,
    quickAnswer:
      'Sur iPhone et iPad, Safari n’enregistre pas les vidéos téléchargées directement dans l’app Photos, mais dans le dossier Téléchargements de l’app Fichiers (sur iCloud Drive ou Sur mon iPhone). Ouvrez le fichier MP4 depuis Fichiers, touchez le bouton Partager puis choisissez Enregistrer la vidéo pour l’ajouter à Photos.',
    introduction: [
      'Vous venez de télécharger une vidéo publique depuis VIDNEX sur votre iPhone ou votre iPad, la petite flèche bleue de Safari confirme la fin du transfert, mais lorsque vous ouvrez l’application Photos, le clip est introuvable. Ce comportement surprend presque tous les utilisateurs qui passent d’Android à iOS, alors que le fichier est bien présent sur l’appareil.',
      'Dans ce guide concret, nous expliquons où Safari et Chrome rangent réellement vos fichiers MP4, JPG ou ZIP sous iOS et iPadOS, comment transférer une vidéo dans votre pellicule en quelques secondes, comment vérifier le dossier de destination et comment débloquer les situations où la vidéo se lit en plein écran au lieu de se télécharger.',
    ],
    tableOfContents: [
      {
        id: 'pourquoi-ios-separe-fichiers-et-photos',
        heading: '1. Pourquoi iOS n’envoie pas les téléchargements directement dans Photos',
      },
      {
        id: 'etapes-retrouver-et-enregistrer-dans-photos',
        heading: '2. Étapes pour retrouver la vidéo dans Fichiers et l’enregistrer dans Photos',
      },
      {
        id: 'emplacements-safari-chrome-navigateurs-integres',
        heading: '3. Comparatif des emplacements : Safari, Chrome et navigateurs intégrés',
      },
      {
        id: 'verifier-dossier-telechargements-reglages',
        heading: '4. Vérifier si Safari enregistre sur iCloud Drive ou Sur mon iPhone',
      },
      {
        id: 'problemes-frequents-iphone-ipad',
        heading: '5. Problèmes fréquents sur iPhone : lecture plein écran, ZIP et audio',
      },
      {
        id: 'stockage-confidentialite-et-bon-usage',
        heading: '6. Gestion du stockage local, vie privée et respect des droits',
      },
    ],
    content: [
      {
        id: 'pourquoi-ios-separe-fichiers-et-photos',
        heading: '1. Pourquoi iOS n’envoie pas les téléchargements directement dans Photos',
        paragraphs: [
          'Par conception, Apple isole les navigateurs web dans un bac à sable strict (sandbox) qui les empêche d’écrire directement dans votre photothèque personnelle. Cette barrière empêche un site tiers d’injecter des images ou des vidéos dans vos albums sans votre validation explicite.',
          'Tout fichier téléchargé depuis le web passe donc par le gestionnaire de téléchargements d’iOS et atterrit dans l’application native Fichiers (icône de dossier bleu). Selon la configuration de votre appareil, le dossier Téléchargements se trouve soit dans iCloud Drive, soit dans l’espace local Sur mon iPhone ou Sur mon iPad.',
          'Tant que la vidéo reste uniquement dans Fichiers, vous pouvez la lire sans problème depuis cette application, mais elle n’apparaît pas dans la pellicule Photos ni dans le sélecteur rapide de certaines applications de montage ou de messagerie.',
        ],
      },
      {
        id: 'etapes-retrouver-et-enregistrer-dans-photos',
        heading: '2. Étapes pour retrouver la vidéo dans Fichiers et l’enregistrer dans Photos',
        paragraphs: [
          'Dès que le téléchargement lancé depuis VIDNEX se termine dans Safari, suivez ces cinq étapes simples pour placer la vidéo dans votre galerie Photos :',
        ],
        orderedSteps: [
          'Dans la barre d’adresse de Safari, touchez l’icône de flèche vers le bas entourée d’un cercle bleu puis appuyez sur Téléchargements, ou ouvrez directement l’app Fichiers depuis l’écran d’accueil.',
          'Dans l’app Fichiers, touchez l’onglet Explorer en bas puis ouvrez le dossier Téléchargements (sous iCloud Drive ou Sur mon iPhone).',
          'Touchez le fichier MP4 qui vient d’arriver ; si la liste est longue, utilisez le menu de tri en haut à droite pour classer par Date afin d’afficher le plus récent en premier.',
          'Dans l’aperçu de la vidéo, touchez l’icône Partager (le carré surmonté d’une flèche vers le haut) en bas à gauche.',
          'Sélectionnez Enregistrer la vidéo dans la feuille de partage. Le clip apparaît immédiatement dans l’app Photos, dans l’album Récents.',
        ],
        technicalCallout: {
          label: 'Éviter les doublons sur le stockage',
          text: 'L’action Enregistrer la vidéo copie le fichier MP4 dans la photothèque Apple Photos tout en conservant l’original dans Fichiers. Une fois la présence de la vidéo confirmée dans Photos, vous pouvez supprimer la copie du dossier Téléchargements pour libérer de l’espace.',
        },
      },
      {
        id: 'emplacements-safari-chrome-navigateurs-integres',
        heading: '3. Comparatif des emplacements : Safari, Chrome et navigateurs intégrés',
        paragraphs: [
          'Le dossier exact dépend du navigateur utilisé au moment du téléchargement. Le tableau ci-dessous récapitule où chercher vos fichiers sur iPhone et iPad selon chaque cas :',
        ],
        table: {
          headers: [
            'Navigateur sur iPhone / iPad',
            'Emplacement du fichier',
            'Action vers Apple Photos',
            'Fiabilité pratique',
          ],
          rows: [
            [
              'Safari (recommandé sur iOS)',
              'Fichiers → iCloud Drive ou Sur mon iPhone → Téléchargements',
              'Ouvrir la vidéo → Partager → Enregistrer la vidéo',
              'Gestionnaire natif complet et stable',
            ],
            [
              'Google Chrome pour iOS',
              'Fichiers → Sur mon iPhone → Chrome',
              'Appuyer sur Ouvrir dans… → Enregistrer la vidéo',
              'Fiable, avec son propre sous-dossier local',
            ],
            [
              'Firefox pour iOS',
              'Fichiers → Sur mon iPhone → Firefox → Downloads',
              'Ouvrir la vidéo → Partager → Enregistrer la vidéo',
              'Fonctionne bien pour MP4 et images JPG',
            ],
            [
              'Navigateur intégré (TikTok, Instagram, X)',
              'Vue web restreinte sans gestionnaire de fichiers',
              'Souvent bloquée ou limitée à la lecture seule',
              'Toujours choisir Ouvrir dans Safari avant de télécharger',
            ],
          ],
        },
      },
      {
        id: 'verifier-dossier-telechargements-reglages',
        heading: '4. Vérifier si Safari enregistre sur iCloud Drive ou Sur mon iPhone',
        paragraphs: [
          'Si le dossier Sur mon iPhone → Téléchargements semble vide alors que Safari a bien affiché la progression, ouvrez Réglages → Apps → Safari → Téléchargements. Vous verrez immédiatement si le répertoire actif est réglé sur iCloud Drive, Sur mon iPhone ou un dossier personnalisé.',
          'Lorsque iCloud Drive est sélectionné mais que votre quota iCloud gratuit de 5 Go est saturé, les téléchargements peuvent échouer silencieusement ou rester en attente de synchronisation. Basculer le réglage sur Sur mon iPhone corrige aussitôt ce blocage et conserve les vidéos uniquement dans la mémoire interne.',
          'Dans ce même écran de réglages, l’option Supprimer les éléments téléchargés (Après un jour, À la fermeture de Safari ou Manuellement) ne concerne que la petite liste de raccourcis sous la flèche bleue de Safari : elle n’efface jamais le fichier MP4 enregistré dans l’app Fichiers.',
        ],
      },
      {
        id: 'problemes-frequents-iphone-ipad',
        heading: '5. Problèmes fréquents sur iPhone : lecture plein écran, ZIP et audio',
        paragraphs: [
          'Il arrive que Safari ouvre directement le lecteur vidéo plein écran au lieu de proposer la fenêtre Télécharger. VIDNEX envoie un en-tête HTTP Content-Disposition conçu pour déclencher l’enregistrement, mais si un bloqueur ou un lien direct ouvre quand même la lecture, appuyez longuement sur le bouton de téléchargement et choisissez Télécharger le fichier lié.',
          'Lorsque l’option Enregistrer la vidéo n’apparaît pas dans le menu Partager de Fichiers, vérifiez l’extension du document. Pour un carrousel de photos téléchargé en archive ZIP, touchez simplement le fichier ZIP une fois dans Fichiers : iOS le décompresse automatiquement dans un dossier voisin contenant toutes les images JPG prêtes à être enregistrées dans Photos.',
          'Pour une piste purement audio (MP3 ou M4A), iOS masque volontairement Enregistrer la vidéo car la photothèque Apple Photos ne gère pas les fichiers audio seuls. Vous pouvez écouter la piste directement dans Fichiers ou l’envoyer vers Dictaphone, GarageBand ou votre lecteur audio favori.',
        ],
      },
      {
        id: 'stockage-confidentialite-et-bon-usage',
        heading: '6. Gestion du stockage local, vie privée et respect des droits',
        paragraphs: [
          'Avant de récupérer plusieurs clips HD sur un iPhone dont la mémoire approche de la saturation, vérifiez l’espace disponible dans Réglages → Général → Stockage iPhone. Si vous utilisez régulièrement des vidéos pour des références hors ligne, pensez à nettoyer les anciens doublons restés dans Téléchargements après les avoir copiés dans Photos.',
          'VIDNEX fonctionne directement dans votre navigateur mobile sans application à installer, sans création de compte et sans stockage distant de vos médias. Limitez toujours vos enregistrements aux publications publiques et respectez scrupuleusement les droits d’auteur ainsi que les conditions des plateformes sources.',
        ],
      },
    ],
    faq: [
      {
        question: 'Pourquoi ma vidéo téléchargée sur iPhone n’apparaît-elle pas directement dans Photos ?',
        answer:
          'Sous iOS, Apple empêche Safari et Chrome d’écrire directement dans votre photothèque par mesure de sécurité. Chaque vidéo est d’abord enregistrée dans l’app Fichiers, au sein du dossier Téléchargements. Il suffit ensuite de l’ouvrir, de toucher Partager puis Enregistrer la vidéo pour l’afficher dans Photos.',
      },
      {
        question: 'Comment retrouver l’app Fichiers si je ne la vois pas sur mon écran d’accueil ?',
        answer:
          'Faites glisser votre doigt vers le bas au milieu de l’écran d’accueil de votre iPhone pour ouvrir la recherche Spotlight, puis tapez Fichiers. Si l’application native d’Apple avait été désinstallée auparavant, vous pouvez la réinstaller gratuitement depuis l’App Store en recherchant Fichiers par Apple.',
      },
      {
        question: 'Comment ouvrir un carrousel ZIP téléchargé avec VIDNEX sur iPhone ?',
        answer:
          'Ouvrez l’application Fichiers, accédez au dossier Téléchargements et touchez simplement le fichier ZIP une seule fois. iOS décompresse automatiquement l’archive dans un nouveau dossier juste à côté sans application externe. Ouvrez ce dossier, sélectionnez les images JPG puis utilisez Partager et Enregistrer les images.',
      },
      {
        question: 'La suppression automatique de la liste Safari efface-t-elle mes vidéos ?',
        answer:
          'Non. Le réglage Supprimer les éléments téléchargés dans Safari vide uniquement l’historique rapide affiché sous la flèche bleue de la barre d’adresse. Les véritables fichiers MP4 enregistrés dans le dossier Téléchargements de l’app Fichiers restent intacts jusqu’à ce que vous choisissiez de les effacer.',
      },
      {
        question: 'Que faire si le bouton de téléchargement ne répond pas dans l’app TikTok ou Instagram ?',
        answer:
          'Les navigateurs intégrés aux réseaux sociaux bloquent souvent le gestionnaire de téléchargements d’iOS. Touchez les trois points ou l’icône de partage en coin d’écran et choisissez Ouvrir dans Safari. Une fois sur Safari, VIDNEX peut transmettre normalement le fichier MP4 vers votre app Fichiers.',
      },
    ],
    ctaTitle: 'Télécharger des vidéos publiques proprement sur iPhone',
    ctaDescription:
      'Ouvrez VIDNEX dans Safari sur votre iPhone ou iPad, collez un lien public et récupérez vos fichiers MP4 directement dans l’app Fichiers.',
    ctaButtonLabel: 'Ouvrir VIDNEX',
    internalLinks: [
      {
        label: 'Accueil VIDNEX — Tous les outils publics',
        description:
          'Téléchargez des médias publics TikTok, Instagram, Facebook, X et LinkedIn directement depuis Safari.',
        targetType: 'home',
      },
      {
        label: 'Enregistrer une vidéo TikTok sans filigrane',
        description:
          'Méthode complète pour sauvegarder des clips TikTok publics propres en MP4 sur mobile et ordinateur.',
        targetType: 'blog_article',
        targetArticleId: 'save-public-tiktok-videos-without-watermark-guide',
      },
      {
        label: 'Reel Instagram téléchargé sans son : causes et solutions',
        description:
          'Comprendre les flux DASH séparés sur Instagram et récupérer des Reels complets avec audio synchronisé.',
        targetType: 'blog_article',
        targetArticleId: 'instagram-reels-carousels-resolution-compression-guide',
      },
    ],
    sources: [
      {
        title: 'Retrouver les fichiers téléchargés sur iPhone et iPad',
        publisher: 'Assistance Apple',
        url: 'https://support.apple.com/en-us/102440',
      },
      {
        title: 'En-tête HTTP Content-Disposition',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition',
      },
    ],
  },

  'linkedin-public-profile-photo-view-save-guide': {
    locale: 'fr',
    localizedSlug: 'photo-profil-linkedin-publique-voir-en-grand-enregistrer',
    translationStatus: 'published',
    publishedAt: '2026-11-22',
    updatedAt: '2026-11-22',
    title: 'Photo de profil LinkedIn publique : comment la voir en grand et l’enregistrer',
    excerpt:
      'Découvrez comment afficher en grand une photo de profil LinkedIn publique (/in/slug) et l’enregistrer en JPG avec VIDNEX, avec gestion transparente du mur de connexion.',
    metaTitle: 'Photo de profil LinkedIn publique : voir et enregistrer',
    metaDescription:
      'Guide pratique pour voir en grand et enregistrer une photo de profil LinkedIn publique (/in/slug) en JPG, limites de l’authwall et aperçu local.',
    primaryKeyword: 'photo de profil linkedin publique voir en grand enregistrer',
    secondaryKeywords: [
      'telecharger photo profil linkedin',
      'agrandir photo profil linkedin publique',
      'recuperer sa photo linkedin en hd',
      'enregistrer avatar linkedin jpg',
    ],
    searchIntent:
      'Tutoriel clair pour afficher en taille réelle et enregistrer localement une photo de profil LinkedIn publique sans connexion ni collecte de données personnelles.',
    readingTimeMinutes: 6,
    quickAnswer:
      'Pour voir en grand et enregistrer une photo de profil LinkedIn publique, copiez l’adresse personnelle au format linkedin.com/in/identifiant et collez-la dans l’outil LinkedIn de VIDNEX. Si le portrait est public, VIDNEX lit uniquement les métadonnées d’avatar, vérifie le format image et propose le fichier en JPG.',
    introduction: [
      'Sur LinkedIn, les photos de profil s’affichent le plus souvent dans un petit médaillon circulaire qui ne permet pas d’apprécier le cadrage ni la netteté réelle du fichier. Que vous souhaitiez récupérer votre propre portrait professionnel après avoir perdu le fichier d’origine ou vérifier le rendu de votre photo publique avant une candidature, le clic droit classique sur la page est fréquemment bloqué ou renvoie une miniature.',
      'Dans ce guide, nous détaillons exactement quelles adresses LinkedIn fonctionnent, ce que fait réellement l’outil VIDNEX sur le plan technique, pourquoi un mur de connexion peut apparaître et comment utiliser la solution de repli 100 % locale dans votre navigateur.',
    ],
    tableOfContents: [
      {
        id: 'urls-linkedin-prises-en-charge',
        heading: '1. Quelles URL LinkedIn sont prises en charge et quelles pages sont refusées',
      },
      {
        id: 'etapes-afficher-et-enregistrer-photo-linkedin',
        heading: '2. Étapes pour voir en grand et enregistrer une photo de profil publique',
      },
      {
        id: 'comportement-technique-et-formats-vidnex',
        heading: '3. Fonctionnement réel de VIDNEX, formats d’image et garde-fous',
      },
      {
        id: 'mur-connexion-linkedin-et-depot-local',
        heading: '4. Que faire face au mur de connexion LinkedIn : le dépôt manuel 100 % local',
      },
      {
        id: 'reglages-visibilite-photo-linkedin',
        heading: '5. Vérifier la visibilité publique de votre propre photo sur LinkedIn',
      },
      {
        id: 'vie-privee-et-droit-a-l-image',
        heading: '6. Respect de la vie privée, droit à l’image et usages autorisés',
      },
    ],
    content: [
      {
        id: 'urls-linkedin-prises-en-charge',
        heading: '1. Quelles URL LinkedIn sont prises en charge et quelles pages sont refusées',
        paragraphs: [
          'L’outil LinkedIn de VIDNEX suit un périmètre strict et transparent : il traite exclusivement les profils personnels publics dont l’adresse contient le segment /in/{slug}. Les variantes régionales (fr.linkedin.com, es.linkedin.com, de.linkedin.com, m.linkedin.com) ainsi que les suffixes de langue en fin d’URL (/fr, /en) sont automatiquement normalisés.',
          'Les pages d’entreprise (/company/), les publications individuelles (/posts/ ou /feed/update/), les vidéos LinkedIn et les offres d’emploi ne sont pas prises en charge et renvoient un message explicite. De même, les profils privés ou les comptes dont le portrait est restreint aux relations connectées ne peuvent pas être lus sans authentification.',
          'Si un profil public ne comporte aucune photo téléversée et n’affiche que la silhouette grise générique de LinkedIn, VIDNEX détecte cet avatar par défaut et ne génère pas de fausse image de profil.',
        ],
      },
      {
        id: 'etapes-afficher-et-enregistrer-photo-linkedin',
        heading: '2. Étapes pour voir en grand et enregistrer une photo de profil publique',
        paragraphs: [
          'La démarche ne nécessite ni connexion à un compte LinkedIn ni extension de navigateur. Suivez ces cinq étapes pour obtenir le fichier image public :',
        ],
        orderedSteps: [
          'Ouvrez le profil LinkedIn public souhaité dans votre navigateur ou votre application, puis copiez son adresse au format linkedin.com/in/{slug}.',
          'Rendez-vous sur l’outil Photo de profil LinkedIn de VIDNEX et collez l’URL dans le champ dédié.',
          'Lancez la vérification : VIDNEX contrôle la structure /in/ et consulte uniquement les métadonnées publiques d’avatar (OpenGraph, Twitter Card, données structurées Person ou URL signée media.licdn.com).',
          'Une validation binaire par magic bytes vérifie que le fichier est bien une image JPG, PNG ou WebP valide d’au maximum 10 Mo avant d’afficher l’aperçu en taille réelle.',
          'Cliquez sur le bouton d’enregistrement pour sauvegarder directement le fichier sous le nom linkedin_{slug}_profile.jpg sur votre appareil.',
        ],
        technicalCallout: {
          label: 'Zéro collecte de profil ou de CV',
          text: 'VIDNEX ne collecte jamais le nom complet, l’intitulé de poste, l’entreprise, les coordonnées ni le parcours professionnel. Seule l’adresse publique de l’avatar est résolue, avec un cache technique temporaire de 10 minutes pour limiter les requêtes répétées.',
        },
      },
      {
        id: 'comportement-technique-et-formats-vidnex',
        heading: '3. Fonctionnement réel de VIDNEX, formats d’image et garde-fous',
        paragraphs: [
          'Le tableau récapitulatif ci-dessous décrit précisément ce que fait — et ne fait pas — l’outil LinkedIn de VIDNEX :',
        ],
        table: {
          headers: [
            'Élément technique',
            'Comportement réel dans VIDNEX',
            'Ce qu’il faut retenir',
          ],
          rows: [
            [
              'Adresses acceptées',
              'Profils personnels publics linkedin.com/in/{slug} uniquement',
              'Refus explicite de /company/, /posts/ et des vidéos',
            ],
            [
              'Données consultées',
              'Uniquement les métadonnées publiques de l’avatar (OpenGraph / Person / media.licdn.com)',
              'Aucune extraction de nom, poste, entreprise ou CV',
            ],
            [
              'Validation et taille',
              'Contrôle binaire magic bytes (JPG, PNG, WebP) jusqu’à 10 Mo',
              'Écarte les réponses HTML d’erreur et avatars gris par défaut',
            ],
            [
              'Fichier enregistré',
              'linkedin_{slug}_profile.jpg (cache technique de 10 min)',
              'Compatible directement sur iPhone, Android, macOS et Windows',
            ],
            [
              'Mur de connexion (authwall)',
              'Jamais contourné ; affichage d’un dépôt manuel 100 % local',
              'Zéro octet envoyé vers le serveur en mode aperçu local',
            ],
          ],
        },
      },
      {
        id: 'mur-connexion-linkedin-et-depot-local',
        heading: '4. Que faire face au mur de connexion LinkedIn : le dépôt manuel 100 % local',
        paragraphs: [
          'Selon la configuration du compte ou les politiques anti-scraping de LinkedIn, une requête publique non authentifiée peut rencontrer un mur de connexion (authwall). VIDNEX ne tente jamais de contourner cette barrière et ne vous demandera jamais vos identifiants ni vos cookies de session.',
          'Dans ce cas, l’interface affiche un message transparent accompagné d’une zone de glisser-déposer 100 % locale dans votre navigateur. Si vous avez déjà enregistré votre photo depuis votre session connectée, vous pouvez la déposer dans cette zone pour contrôler sa validité (vérification magic bytes) et l’examiner avec le zoom HD.',
          'Durant cette prévisualisation manuelle, aucun octet n’est transmis sur le réseau : le fichier reste intégralement dans la mémoire locale de votre navigateur.',
        ],
      },
      {
        id: 'reglages-visibilite-photo-linkedin',
        heading: '5. Vérifier la visibilité publique de votre propre photo sur LinkedIn',
        paragraphs: [
          'Si votre propre photo n’apparaît pas en accès public alors que vous souhaitez qu’elle reste visible pour les recruteurs ou les moteurs de recherche, consultez les paramètres de votre compte. Comme l’explique le Centre d’aide officiel de LinkedIn, le menu Préférences et confidentialité → Visibilité → Modifier votre profil public permet de choisir entre Vos relations, Votre réseau, Tous les membres LinkedIn ou Public.',
          'Après une modification de ce réglage ou un changement de portrait, les serveurs de distribution mettent parfois plusieurs minutes à propager la nouvelle image. Patientez brièvement, puis relancez la vérification après expiration du cache technique de 10 minutes.',
        ],
      },
      {
        id: 'vie-privee-et-droit-a-l-image',
        heading: '6. Respect de la vie privée, droit à l’image et usages autorisés',
        paragraphs: [
          'Une photo de profil représente une personne physique et relève à la fois du droit à l’image et du droit d’auteur du photographe. N’enregistrez jamais le portrait d’un tiers pour le republier sans accord, créer un faux profil ou alimenter une base de données commerciale.',
          'Réservez cet outil à la récupération de votre propre photo publique, au contrôle de votre présence en ligne ou à la préparation d’un visuel d’intervenant avec l’autorisation explicite de la personne concernée.',
        ],
      },
    ],
    faq: [
      {
        question: 'VIDNEX peut-il afficher une photo de profil LinkedIn privée ?',
        answer:
          'Non. Si la visibilité de la photo est limitée aux relations ou aux membres connectés de LinkedIn, le serveur ne rend pas l’image publique. VIDNEX ne contourne jamais un mur de connexion et propose à la place une zone d’aperçu manuel entièrement locale dans votre navigateur.',
      },
      {
        question: 'Pourquoi mon lien /company/ ou une publication LinkedIn est-il refusé ?',
        answer:
          'L’outil LinkedIn de VIDNEX accepte uniquement les profils personnels publics au format linkedin.com/in/{slug}. Les pages entreprises (/company/), les posts du fil d’actualité (/posts/) ainsi que les vidéos LinkedIn ne font pas partie des contenus pris en charge et déclenchent un message clair.',
      },
      {
        question: 'VIDNEX récupère-t-il le nom, l’entreprise ou le CV du profil LinkedIn ?',
        answer:
          'Non. VIDNEX lit exclusivement les métadonnées publiques liées à l’avatar (OpenGraph, Twitter Card, Person ou media.licdn.com) afin de vérifier l’image en JPG, PNG ou WebP jusqu’à 10 Mo. Aucune donnée biographique, aucun intitulé de poste et aucun CV ne sont collectés.',
      },
      {
        question: 'Mes fichiers sont-ils envoyés au serveur si j’utilise le glisser-déposer manuel ?',
        answer:
          'Non. Lorsque le mur de connexion LinkedIn apparaît et que vous utilisez le dépôt manuel de repli, la validation magic bytes et l’aperçu avec zoom HD s’exécutent entièrement dans votre navigateur. Aucun octet de votre image n’est transféré vers les serveurs de VIDNEX.',
      },
      {
        question: 'Sous quel nom la photo de profil publique est-elle téléchargée ?',
        answer:
          'Une fois le flux image validé comme fichier JPG, PNG ou WebP de moins de 10 Mo et distinct de la silhouette grise par défaut, VIDNEX déclenche le téléchargement direct sous le nom standardisé linkedin_{slug}_profile.jpg dans votre dossier Téléchargements habituel.',
      },
    ],
    ctaTitle: 'Voir une photo de profil LinkedIn publique en grand',
    ctaDescription:
      'Collez une adresse publique linkedin.com/in/{slug} dans l’outil VIDNEX pour vérifier et enregistrer l’avatar public en JPG.',
    ctaButtonLabel: 'Ouvrir l’outil LinkedIn',
    internalLinks: [
      {
        label: 'Outil Photo de profil LinkedIn publique',
        description:
          'Affichez en taille réelle et sauvegardez une photo de profil LinkedIn /in/ publique sans compte.',
        targetType: 'platform',
        platformKey: 'linkedin',
      },
      {
        label: 'Où vont les fichiers téléchargés sur iPhone et iPad ?',
        description:
          'Retrouvez vos images et vidéos dans l’app Fichiers d’iOS et transférez-les vers Apple Photos.',
        targetType: 'blog_article',
        targetArticleId: 'how-to-download-videos-on-iphone',
      },
      {
        label: 'Enregistrer une vidéo TikTok sans filigrane',
        description:
          'Récupérez un flux MP4 propre ou des photos de carrousel depuis un lien TikTok public.',
        targetType: 'blog_article',
        targetArticleId: 'save-public-tiktok-videos-without-watermark-guide',
      },
    ],
    sources: [
      {
        title: 'En-tête HTTP Content-Disposition',
        publisher: 'MDN Web Docs',
        url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition',
      },
      {
        title: 'Retrouver les fichiers téléchargés sur iPhone et iPad',
        publisher: 'Assistance Apple',
        url: 'https://support.apple.com/en-us/102440',
      },
    ],
  },
};
