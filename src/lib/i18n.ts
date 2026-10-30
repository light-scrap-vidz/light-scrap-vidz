import { suiteMessages } from '../suite/messages';

export type Lang = 'en' | 'fr';

const dict: Record<Lang, Record<string, string>> = {
  en: {
    ...suiteMessages.en,
    'about.tagline': 'Download videos from TikTok, Instagram, YouTube, Facebook and hundreds of other sites as MP4 or MP3.',
    // Header
    'header.back': 'Back',
    'header.backBlocked': 'Cancel to go back',

    // URL input
    'url.placeholder': 'Paste a video link…',
    'url.aria': 'Video URL',
    'url.paste': 'Paste from clipboard',
    'url.fetch': 'Fetch info',
    'url.supports': 'Supports:',

    // Tabs
    'tab.recent': 'Recent',
    'tab.queue': 'Queue',
    'tab.clearAll': 'Clear all',
    'tab.clearDone': 'Clear done',

    // History
    'history.empty': 'No downloads yet',
    'history.fetching': 'Fetching info…',
    'history.reveal': 'Reveal in folder',

    // Queue
    'queue.placeholder': 'Paste one or more links, one per line…',
    'queue.add': 'Add to queue',
    'queue.remove': 'Remove from queue',

    // Preview
    'preview.single': 'Single video',
    'preview.playlist': 'Playlist',
    'preview.untitledPlaylist': 'Untitled Playlist',
    'preview.videos': '{count} videos',
    'preview.selected': '{count} selected',
    'preview.shown': '{count} videos shown',
    'preview.selectNone': 'None',
    'preview.selectAll': 'All',

    // Options
    'opt.saveTo': 'Save to',
    'opt.chooseFolder': 'Choose folder…',
    'opt.chooseFolderAria': 'Choose output folder',
    'opt.format': 'Format',
    'opt.video': 'Video · MP4',
    'opt.audio': 'Audio · MP3',
    'opt.quality': 'Quality',
    'opt.qualityBest': 'Best',
    'opt.signIn': 'Sign-in',
    'opt.cookiesNone': 'None',
    'opt.count': 'Count',
    'opt.countAria': 'Number of videos to download',
    'opt.latest': 'Latest {count}',
    'opt.allVideos': 'All videos',

    // Download
    'dl.mp4': 'Download MP4',
    'dl.mp3': 'Extract MP3',
    'dl.selectedVideo': 'Download {count} selected',
    'dl.selectedAudio': 'Extract {count} selected',
    'dl.playlistVideo': 'Download {count} videos',
    'dl.playlistAudio': 'Extract {count} MP3s',
    'dl.cancel': 'Cancel download',
    'dl.eta': 'ETA',
    'dl.complete': 'Download complete',
    'dl.openFile': 'Open file',
    'dl.reveal': 'Reveal in folder',
    'dl.playlist': 'Playlist',
    'dl.download': 'Download',
    'dl.playlistMeta': 'Playlist · {count} videos',
    'dl.another': 'Download another',
    'dl.item': 'Item {current} of {total}',

    // Settings
    'set.title': 'Settings',
    'set.close': 'Close settings',
    'set.downloads': 'Downloads',
    'set.defaultFolder': 'Default folder',
    'set.notify': 'Notify on finish',
    'set.notifySub': 'System notification',
    'set.notifyAria': 'Toggle notification',
    'set.auth': 'Authentication',
    'set.authSub': 'Use cookies from browser',

    // Updates
    'ytdlp.updating': 'Updating yt-dlp…',
    'ytdlp.updated': 'yt-dlp updated',
    'ytdlp.failed': 'yt-dlp update failed',

    // yt-dlp errors, keyed so the message can be translated after the fact
    'err.loginRequired':
      'Login required — select your browser in the Auth selector (requires an active session).',
    'err.instagramLogin':
      'Instagram requires login — select your browser in the Auth selector (you must be logged in to Instagram in that browser).',
    'err.facebookLogin':
      'Facebook requires login — select your browser in the Auth selector (you must be logged in to Facebook in that browser).',
    'err.cookiesRequired':
      'This platform requires cookies — select your browser in the Auth selector.',
    'err.curlCffi':
      'Missing dependency (curl-cffi) — click "Check for updates" in Settings to install it automatically.',
    'err.ipBlocked':
      'Your IP is blocked by this platform. Try using a VPN or selecting browser cookies in the Auth selector.',
    'err.geoBlocked': 'This video is not available in your region.',
    'err.noVideo': 'No video found — this post does not contain a downloadable video.',
    'err.clipGone': 'This clip is no longer available.',
    'err.private': 'This video is private.',
    'err.ageRestricted': 'Age-restricted — log in via the Auth selector to download.',
    'err.unavailable': 'This video is unavailable or has been removed.',
    'err.copyright': 'This video was removed for copyright reasons.',
    'err.accountGone': 'The channel or account no longer exists.',
    'err.cannotExtract': 'Unable to extract video — the URL may not be supported.',
    'err.rateLimited': 'Rate-limited by the platform — wait a moment and try again.',
    'err.brokenExtractor':
      'The extractor for this platform is broken — run "Check for updates" in the settings.',

    // Singular forms, picked through Intl.PluralRules when the vars carry a `count`
    'preview.videos.one': '{count} video',
    'preview.selected.one': '{count} selected',
    'preview.shown.one': '{count} video shown',
    'dl.selectedVideo.one': 'Download {count} selected',
    'dl.selectedAudio.one': 'Extract {count} selected',
    'dl.playlistVideo.one': 'Download {count} video',
    'dl.playlistAudio.one': 'Extract {count} MP3',
    'dl.playlistMeta.one': 'Playlist · {count} video',
    'opt.latest.one': 'Latest {count}',
    'preview.videosPlus.one': '{count}+ video',

    // Errors raised by the app itself
    'err.ytdlpMissing':
      'yt-dlp was not found — open Settings and click "Check for updates" to download it.',
    'err.spawn': 'Could not start yt-dlp — try "Check for updates" in Settings.',
    'err.checksum': 'The yt-dlp download failed its integrity check and was discarded.',
    'err.generic': 'The download failed.',

    'err.parse':
      'The answer of yt-dlp could not be read — try again, or update yt-dlp in Settings.',
    'err.alreadyRunning': 'This link is already being downloaded.',
    'err.updateRunning': 'An update is already running.',
    'err.badOutputDir': 'The destination folder does not exist — choose another one.',
    'err.badBrowser': 'This browser cannot be used for sign-in.',
    'err.unsupportedUrl': 'This link is not supported.',
    'err.fileNotFound': 'File not found — it was moved or deleted.',
    'err.updateFailed': 'The update failed — check your internet connection and try again.',
    'err.ffmpegMissing':
      'ffmpeg is missing — it is needed for the Best quality and MP3 extraction. Install it (for example "brew install ffmpeg") and restart the app.',
    'err.safariAccess':
      'Safari cookies are protected — give the app Full Disk Access in System Settings › Privacy & Security, or pick another sign-in option.',

    // Environment warnings
    'warn.ffmpeg':
      'ffmpeg was not found: the Best quality and MP3 extraction will fail. Install it (for example "brew install ffmpeg") and restart the app.',
    'warn.jsRuntime':
      'No JavaScript runtime (deno, node or bun) was found: YouTube downloads may miss formats or stop working. Install deno (for example "brew install deno") or Node.js.',
    'warn.dismiss': 'Dismiss',

    // Cookies
    'opt.cookiesAuto': 'Auto',
    'opt.chooseFolderHint': 'Choose where to save the files',

    // Progress
    'dl.stage.merging': 'Merging video and audio…',
    'dl.stage.converting': 'Converting…',
    'dl.stage.fixing': 'Fixing the file…',
    'dl.stage.processing': 'Finishing…',
    'dl.progressAria': 'Download progress',
    'dl.downloadedSoFar': '{amount} downloaded',
    'dl.playlistVideoMany': 'Download the videos',
    'dl.playlistAudioMany': 'Extract the MP3s',

    // Playlist paging
    'preview.videosPlus': '{count}+ videos',
    'preview.loadMore': 'Load more',
    'preview.loadingMore': 'Loading…',

    // Queue
    'queue.aria': 'Links to download',
    'queue.retry': 'Retry',
    'queue.retryFailed': 'Retry failed',
    'queue.skipped': '{count} links ignored (invalid or already queued)',
    'queue.skipped.one': '{count} link ignored (invalid or already queued)',
    'queue.finished': '{count} downloads finished',
    'queue.finished.one': '{count} download finished',
    'queue.openFailed': 'Could not open the file',

    // History
    'history.removeMissing': 'Remove from history',
    'tab.clearConfirm': 'Confirm',
    'tab.clearCancel': 'Cancel',
    'tab.list': 'Home sections',

    // Misc
    'common.unknown': 'Unknown',
    'boundary.title': 'Something went wrong.',
    'boundary.reload': 'Reload',
    'ytdlp.upToDate': 'yt-dlp was already up to date',
  },
  fr: {
    ...suiteMessages.fr,
    'about.tagline': "Téléchargez des vidéos de TikTok, Instagram, YouTube, Facebook et de centaines d'autres sites en MP4 ou MP3.",
    // Header
    'header.back': 'Retour',
    'header.backBlocked': 'Annulez pour revenir en arrière',

    // URL input
    'url.placeholder': 'Collez un lien vidéo…',
    'url.aria': 'URL de la vidéo',
    'url.paste': 'Coller depuis le presse-papiers',
    'url.fetch': 'Récupérer les infos',
    'url.supports': 'Compatible :',

    // Tabs
    'tab.recent': 'Récents',
    'tab.queue': "File d'attente",
    'tab.clearAll': 'Tout effacer',
    'tab.clearDone': 'Effacer les terminés',

    // History
    'history.empty': 'Aucun téléchargement',
    'history.fetching': 'Récupération…',
    'history.reveal': 'Afficher dans le dossier',

    // Queue
    'queue.placeholder': 'Collez un ou plusieurs liens, un par ligne…',
    'queue.add': "Ajouter à la file d'attente",
    'queue.remove': "Retirer de la file d'attente",

    // Preview
    'preview.single': 'Vidéo seule',
    'preview.playlist': 'Playlist',
    'preview.untitledPlaylist': 'Playlist sans titre',
    'preview.videos': '{count} vidéos',
    'preview.selected': '{count} sélectionnées',
    'preview.shown': '{count} vidéos affichées',
    'preview.selectNone': 'Aucune',
    'preview.selectAll': 'Toutes',

    // Options
    'opt.saveTo': 'Enregistrer dans',
    'opt.chooseFolder': 'Choisir un dossier…',
    'opt.chooseFolderAria': 'Choisir le dossier de destination',
    'opt.format': 'Format',
    'opt.video': 'Vidéo · MP4',
    'opt.audio': 'Audio · MP3',
    'opt.quality': 'Qualité',
    'opt.qualityBest': 'Meilleure',
    'opt.signIn': 'Connexion',
    'opt.cookiesNone': 'Aucun',
    'opt.count': 'Nombre',
    'opt.countAria': 'Nombre de vidéos à télécharger',
    'opt.latest': '{count} dernières',
    'opt.allVideos': 'Toutes les vidéos',

    // Download
    'dl.mp4': 'Télécharger en MP4',
    'dl.mp3': 'Extraire le MP3',
    'dl.selectedVideo': 'Télécharger les {count} sélectionnées',
    'dl.selectedAudio': 'Extraire les {count} sélectionnées',
    'dl.playlistVideo': 'Télécharger {count} vidéos',
    'dl.playlistAudio': 'Extraire {count} MP3',
    'dl.cancel': 'Annuler le téléchargement',
    'dl.eta': 'Restant',
    'dl.complete': 'Téléchargement terminé',
    'dl.openFile': 'Ouvrir le fichier',
    'dl.reveal': 'Afficher dans le dossier',
    'dl.playlist': 'Playlist',
    'dl.download': 'Téléchargement',
    'dl.playlistMeta': 'Playlist · {count} vidéos',
    'dl.another': 'Télécharger une autre vidéo',
    'dl.item': 'Élément {current} sur {total}',

    // Settings
    'set.title': 'Réglages',
    'set.close': 'Fermer les réglages',
    'set.downloads': 'Téléchargements',
    'set.defaultFolder': 'Dossier par défaut',
    'set.notify': 'Notifier à la fin',
    'set.notifySub': 'Notification système',
    'set.notifyAria': 'Activer ou désactiver la notification',
    'set.auth': 'Authentification',
    'set.authSub': 'Utiliser les cookies du navigateur',

    // Updates
    'ytdlp.updating': 'Mise à jour de yt-dlp…',
    'ytdlp.updated': 'yt-dlp a été mis à jour',
    'ytdlp.failed': 'Échec de la mise à jour de yt-dlp',

    // yt-dlp errors
    'err.loginRequired':
      'Connexion requise — sélectionnez votre navigateur dans le sélecteur Connexion (une session active est nécessaire).',
    'err.instagramLogin':
      'Instagram exige une connexion — sélectionnez votre navigateur dans le sélecteur Connexion (vous devez y être connecté à Instagram).',
    'err.facebookLogin':
      'Facebook exige une connexion — sélectionnez votre navigateur dans le sélecteur Connexion (vous devez y être connecté à Facebook).',
    'err.cookiesRequired':
      'Cette plateforme exige des cookies — sélectionnez votre navigateur dans le sélecteur Connexion.',
    'err.curlCffi':
      'Dépendance manquante (curl-cffi) — cliquez sur « Rechercher les mises à jour » dans les réglages pour l’installer automatiquement.',
    'err.ipBlocked':
      'Votre adresse IP est bloquée par cette plateforme. Essayez un VPN, ou sélectionnez les cookies de votre navigateur dans le sélecteur Connexion.',
    'err.geoBlocked': "Cette vidéo n'est pas disponible dans votre région.",
    'err.noVideo': 'Aucune vidéo trouvée — cette publication ne contient rien de téléchargeable.',
    'err.clipGone': "Ce clip n'est plus disponible.",
    'err.private': 'Cette vidéo est privée.',
    'err.ageRestricted':
      'Vidéo réservée aux adultes — connectez-vous via le sélecteur Connexion pour la télécharger.',
    'err.unavailable': 'Cette vidéo est indisponible ou a été supprimée.',
    'err.copyright': 'Cette vidéo a été retirée pour des raisons de droits d’auteur.',
    'err.accountGone': "La chaîne ou le compte n'existe plus.",
    'err.cannotExtract': "Extraction impossible — l'URL n'est peut-être pas prise en charge.",
    'err.rateLimited': 'Trop de requêtes pour la plateforme — patientez un instant et réessayez.',
    'err.brokenExtractor':
      'L’extracteur de cette plateforme est cassé — lancez « Rechercher les mises à jour » dans les réglages.',

    // Formes au singulier, choisies via Intl.PluralRules quand les variables portent `count`
    'preview.videos.one': '{count} vidéo',
    'preview.selected.one': '{count} sélectionnée',
    'preview.shown.one': '{count} vidéo affichée',
    'dl.selectedVideo.one': 'Télécharger {count} sélectionnée',
    'dl.selectedAudio.one': 'Extraire {count} sélectionnée',
    'dl.playlistVideo.one': 'Télécharger {count} vidéo',
    'dl.playlistAudio.one': 'Extraire {count} MP3',
    'dl.playlistMeta.one': 'Playlist · {count} vidéo',
    'opt.latest.one': '{count} dernière',
    'preview.videosPlus.one': '{count}+ vidéo',

    // Erreurs levées par l'app elle-même
    'err.ytdlpMissing':
      'yt-dlp est introuvable — ouvrez les réglages et cliquez sur « Rechercher les mises à jour » pour le télécharger.',
    'err.spawn':
      'Impossible de lancer yt-dlp — essayez « Rechercher les mises à jour » dans les réglages.',
    'err.checksum': 'Le téléchargement de yt-dlp a échoué au contrôle d’intégrité et a été écarté.',
    'err.generic': 'Le téléchargement a échoué.',

    'err.parse':
      'La réponse de yt-dlp est illisible — réessayez, ou mettez yt-dlp à jour dans les réglages.',
    'err.alreadyRunning': 'Ce lien est déjà en cours de téléchargement.',
    'err.updateRunning': 'Une mise à jour est déjà en cours.',
    'err.badOutputDir': "Le dossier de destination n'existe pas — choisissez-en un autre.",
    'err.badBrowser': 'Ce navigateur ne peut pas servir à la connexion.',
    'err.unsupportedUrl': "Ce lien n'est pas pris en charge.",
    'err.fileNotFound': 'Fichier introuvable — il a été déplacé ou supprimé.',
    'err.updateFailed': 'La mise à jour a échoué — vérifiez votre connexion internet et réessayez.',
    'err.ffmpegMissing':
      'ffmpeg est introuvable — il est nécessaire pour la qualité Meilleure et l’extraction MP3. Installez-le (par exemple « brew install ffmpeg ») et relancez l’app.',
    'err.safariAccess':
      'Les cookies de Safari sont protégés — donnez l’accès complet au disque à l’app dans Réglages Système › Confidentialité et sécurité, ou choisissez une autre option de connexion.',

    // Avertissements d'environnement
    'warn.ffmpeg':
      'ffmpeg est introuvable : la qualité Meilleure et l’extraction MP3 échoueront. Installez-le (par exemple « brew install ffmpeg ») et relancez l’app.',
    'warn.jsRuntime':
      'Aucun moteur JavaScript (deno, node ou bun) n’a été trouvé : les téléchargements YouTube risquent de perdre des formats ou de cesser de fonctionner. Installez deno (par exemple « brew install deno ») ou Node.js.',
    'warn.dismiss': 'Fermer',

    // Cookies
    'opt.cookiesAuto': 'Auto',
    'opt.chooseFolderHint': 'Choisissez où enregistrer les fichiers',

    // Progression
    'dl.stage.merging': 'Fusion de la vidéo et de l’audio…',
    'dl.stage.converting': 'Conversion…',
    'dl.stage.fixing': 'Réparation du fichier…',
    'dl.stage.processing': 'Finalisation…',
    'dl.progressAria': 'Progression du téléchargement',
    'dl.downloadedSoFar': '{amount} téléchargés',
    'dl.playlistVideoMany': 'Télécharger les vidéos',
    'dl.playlistAudioMany': 'Extraire les MP3',

    // Pagination des playlists
    'preview.videosPlus': '{count}+ vidéos',
    'preview.loadMore': 'Charger plus',
    'preview.loadingMore': 'Chargement…',

    // File d'attente
    'queue.aria': 'Liens à télécharger',
    'queue.retry': 'Réessayer',
    'queue.retryFailed': 'Réessayer les échecs',
    'queue.skipped': '{count} liens ignorés (invalides ou déjà dans la file)',
    'queue.skipped.one': '{count} lien ignoré (invalide ou déjà dans la file)',
    'queue.finished': '{count} téléchargements terminés',
    'queue.finished.one': '{count} téléchargement terminé',
    'queue.openFailed': 'Impossible d’ouvrir le fichier',

    // Historique
    'history.removeMissing': "Retirer de l'historique",
    'tab.clearConfirm': 'Confirmer',
    'tab.clearCancel': 'Annuler',
    'tab.list': "Sections de l'accueil",

    // Divers
    'common.unknown': 'Inconnu',
    'boundary.title': 'Un problème est survenu.',
    'boundary.reload': 'Recharger',
    'ytdlp.upToDate': 'yt-dlp était déjà à jour',
  },
};

/** Une clé absente du dictionnaire est rendue telle quelle. C'est ce qui permet à
 * `parseYtdlpError` de renvoyer indifféremment une clé connue ou le message brut de
 * yt-dlp : le brut traverse `t` sans être touché. */
export const LANGUAGES: Lang[] = ['en', 'fr'];

/** Les clés connues d'une langue. Sert au test qui vérifie qu'aucune traduction ne
 * manque : une clé absente du français retomberait silencieusement sur l'anglais. */
export function keysOf(lang: Lang): string[] {
  return Object.keys(dict[lang]);
}

export function getT(lang: Lang) {
  const plural = new Intl.PluralRules(lang);
  return (key: string, vars?: Record<string, string | number>): string => {
    // With a numeric `count`, prefer the grammatical form ("1 video" vs "2 videos").
    const form = typeof vars?.count === 'number' ? `${key}.${plural.select(vars.count)}` : null;
    let s =
      (form && (dict[lang][form] ?? dict.en[form])) || (dict[lang][key] ?? dict.en[key] ?? key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
