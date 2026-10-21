export type Lang = 'en' | 'fr';

const dict: Record<Lang, Record<string, string>> = {
  en: {
    // Header
    'header.back': 'Back',
    'header.backBlocked': 'Cancel to go back',
    'header.settings': 'Settings',

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
    'set.language': 'Language',
    'set.about': 'About',
    'set.version': 'Version',

    // Updates
    'update.check': 'Check for updates',
    'update.checking': 'Checking…',
    'update.downloading': 'Downloading…',
    'update.installing': 'Installing…',
    'update.available': 'Update available',
    'update.availableTo': 'Update to v{version}',
    'update.retry': 'Retry',
    'update.upToDate': 'Up to date ✓',
    'update.downloadingPct': 'Downloading {percent}%',
    'ytdlp.updating': 'Updating yt-dlp…',
    'ytdlp.updated': 'yt-dlp up to date',
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

    // Errors raised by the app itself
    'err.ytdlpMissing':
      'yt-dlp was not found — open Settings and click "Check for updates" to download it.',
    'err.spawn': 'Could not start yt-dlp — try "Check for updates" in Settings.',
    'err.checksum': 'The yt-dlp download failed its integrity check and was discarded.',
    'err.generic': 'The download failed.',
  },
  fr: {
    // Header
    'header.back': 'Retour',
    'header.backBlocked': 'Annulez pour revenir en arrière',
    'header.settings': 'Réglages',

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
    'set.language': 'Langue',
    'set.about': 'À propos',
    'set.version': 'Version',

    // Updates
    'update.check': 'Rechercher les mises à jour',
    'update.checking': 'Recherche…',
    'update.downloading': 'Téléchargement…',
    'update.installing': 'Installation…',
    'update.available': 'Mise à jour disponible',
    'update.availableTo': 'Mettre à jour vers la v{version}',
    'update.retry': 'Réessayer',
    'update.upToDate': 'À jour ✓',
    'update.downloadingPct': 'Téléchargement {percent} %',
    'ytdlp.updating': 'Mise à jour de yt-dlp…',
    'ytdlp.updated': 'yt-dlp est à jour',
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
    'err.unavailable': "Cette vidéo est indisponible ou a été supprimée.",
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

    // Erreurs levées par l'app elle-même
    'err.ytdlpMissing':
      'yt-dlp est introuvable — ouvrez les réglages et cliquez sur « Rechercher les mises à jour » pour le télécharger.',
    'err.spawn': 'Impossible de lancer yt-dlp — essayez « Rechercher les mises à jour » dans les réglages.',
    'err.checksum': 'Le téléchargement de yt-dlp a échoué au contrôle d’intégrité et a été écarté.',
    'err.generic': 'Le téléchargement a échoué.',
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
