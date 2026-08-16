export const DB_NAME = 'tepuq_db';
// Bump DB_VERSION when bundled starter images change OR when the schema
// changes (new object stores). v5 adds the TepuQ Kata stores
// (kata_words, kata_settings, kata_progress). v6 re-seeds Kata starter words
// to match Gambar's starter objects (same words + photos). v7 merges the
// Kata word list into the shared `objects` store (kataEnabled toggle) and
// drops the `kata_words` store — one shared word/photo library for both games.
export const DB_VERSION = 7;

export const DEFAULT_SETTINGS = {
  backgroundStyle: 'combined',
  globalEntryAnimation: 'random',
  globalExitAnimation: 'random',
  cardSize: 'medium',
  playMode: 'round-robin',
  burstWindow: 1.5,
  cardVisibleSeconds: 1,
  debounceMs: 300,
  speechRate: 0.95,
  speechPitch: 1.25,
  volume: 0.8,
  autoSmashDelay: 0,
  enabledModes: ['bebas', 'target'],
  fullscreen: true,
};

// One shared word/photo library for both games. Each starter entry carries a
// per-game Kata toggle: single-word names are spellable in TepuQ Kata
// (kataEnabled: true); multi-word names ("Sikat Gigi") are not (kataEnabled:
// false).
export const STARTER_OBJECTS = [
  { name: 'Papa', color: '#4A90D9', image: 'assets/starter/papa.jpg', source: 'starter', kataEnabled: true },
  { name: 'Mama', color: '#E85D75', image: 'assets/starter/mama.jpg', source: 'starter', kataEnabled: true },
  { name: 'Saya', color: '#F5C542', image: 'assets/starter/saya.jpg', source: 'starter', kataEnabled: true },
  { name: 'Kucing', color: '#F5A623', image: 'assets/starter/kucing.jpg', source: 'starter', kataEnabled: true },
  { name: 'Mobil', color: '#D0021B', image: 'assets/starter/mobil.jpg', source: 'starter', kataEnabled: true },
  { name: 'Pisang', color: '#F8E71C', image: 'assets/starter/pisang.jpg', source: 'starter', kataEnabled: true },
  { name: 'Bola', color: '#7ED321', image: 'assets/starter/bola.jpg', source: 'starter', kataEnabled: true },
  { name: 'Boneka', color: '#BD10E0', image: 'assets/starter/boneka.jpg', source: 'starter', kataEnabled: true },
  { name: 'Buku', color: '#800000', image: 'assets/starter/buku.jpg', source: 'starter', kataEnabled: true },
  { name: 'Air', color: '#87CEEB', image: 'assets/starter/air.jpg', source: 'starter', kataEnabled: true },
  { name: 'Susu', color: '#F5F5F5', image: 'assets/starter/susu.jpg', source: 'starter', kataEnabled: true },
  { name: 'Sikat Gigi', color: '#00E5FF', image: 'assets/starter/sikat_gigi.jpg', source: 'starter', kataEnabled: false },
  { name: 'Mandi', color: '#00BCD4', image: 'assets/starter/mandi.jpg', source: 'starter', kataEnabled: true },
  { name: 'Main', color: '#FF6B6B', image: 'assets/starter/main.jpg', source: 'starter', kataEnabled: true },
  { name: 'Makan', color: '#FF9800', image: 'assets/starter/makan.jpg', source: 'starter', kataEnabled: true },
  { name: 'Minum', color: '#2196F3', image: 'assets/starter/minum.jpg', source: 'starter', kataEnabled: true },
  { name: 'Tidur', color: '#9C27B0', image: 'assets/starter/tidur.jpg', source: 'starter', kataEnabled: true },
];

export const ENTRY_ANIMATIONS = ['bounce', 'pop', 'spin', 'slide', 'flip', 'wobble', 'zoom'];
export const EXIT_ANIMATIONS = ['fade', 'zoom', 'slide', 'shrink'];
export const SLIDE_DIRECTIONS = ['left', 'right', 'top', 'bottom'];

// ---- TepuQ Kata (spelling game) -------------------------------------------
// Kata-specific config lives here next to the Gambar config so both games share
// one source of constants. Kata's runtime knobs (letter/slot size, snap
// distance, session length, ...) are stored in the kata_settings store; the
// TTS rate/pitch/volume are NOT here — Kata reuses Gambar's shared speech
// settings via src/speech.js.
//
// Since DB_VERSION 7 there is NO separate word list: TepuQ Kata reads its words
// from the shared `objects` store (the same photos and words as TepuQ Gambar)
// via the kataEnabled per-object toggle. Only kata_settings and kata_progress
// keep their own stores.

export const KATA_DB_STORES = {
  settings: 'kata_settings',
  progress: 'kata_progress',
};

export const KATA_DEFAULT_SETTINGS = {
  letterSize: 110,        // px, letter tile size (drives scatter math)
  slotSize: 120,          // px, slot size
  snapDistance: 80,       // px, magnetic-snap threshold from slot center
  sessionLength: 3,       // words per session before the Win Screen
  showDistractors: false, // MVP: only correct letters are scattered
  enableLetterSpeech: true, // speak the letter ("a!") on a correct snap
  language: 'id-ID',      // TTS locale for Kata (matches Gambar's id-ID)
};

export const KATA_DEFAULT_PROGRESS = {
  completedWords: [],     // array of word ids completed this session
  currentStreak: 0,
  totalSessions: 0,
};
