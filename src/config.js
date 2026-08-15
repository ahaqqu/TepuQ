export const DB_NAME = 'tepuq_db';
// Bump DB_VERSION when bundled starter images change OR when the schema
// changes (new object stores). v5 adds the TepuQ Kata stores
// (kata_words, kata_settings, kata_progress).
export const DB_VERSION = 5;

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

export const STARTER_OBJECTS = [
  { name: 'Papa', color: '#4A90D9', image: 'assets/starter/papa.jpg', source: 'starter' },
  { name: 'Mama', color: '#E85D75', image: 'assets/starter/mama.jpg', source: 'starter' },
  { name: 'Saya', color: '#F5C542', image: 'assets/starter/saya.jpg', source: 'starter' },
  { name: 'Kucing', color: '#F5A623', image: 'assets/starter/kucing.jpg', source: 'starter' },
  { name: 'Mobil', color: '#D0021B', image: 'assets/starter/mobil.jpg', source: 'starter' },
  { name: 'Pisang', color: '#F8E71C', image: 'assets/starter/pisang.jpg', source: 'starter' },
  { name: 'Bola', color: '#7ED321', image: 'assets/starter/bola.jpg', source: 'starter' },
  { name: 'Boneka', color: '#BD10E0', image: 'assets/starter/boneka.jpg', source: 'starter' },
  { name: 'Buku', color: '#800000', image: 'assets/starter/buku.jpg', source: 'starter' },
  { name: 'Air', color: '#87CEEB', image: 'assets/starter/air.jpg', source: 'starter' },
  { name: 'Susu', color: '#F5F5F5', image: 'assets/starter/susu.jpg', source: 'starter' },
  { name: 'Sikat Gigi', color: '#00E5FF', image: 'assets/starter/sikat_gigi.jpg', source: 'starter' },
  { name: 'Mandi', color: '#00BCD4', image: 'assets/starter/mandi.jpg', source: 'starter' },
  { name: 'Main', color: '#FF6B6B', image: 'assets/starter/main.jpg', source: 'starter' },
  { name: 'Makan', color: '#FF9800', image: 'assets/starter/makan.jpg', source: 'starter' },
  { name: 'Minum', color: '#2196F3', image: 'assets/starter/minum.jpg', source: 'starter' },
  { name: 'Tidur', color: '#9C27B0', image: 'assets/starter/tidur.jpg', source: 'starter' },
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

export const KATA_DB_STORES = {
  words: 'kata_words',
  settings: 'kata_settings',
  progress: 'kata_progress',
};

export const KATA_DEFAULT_SETTINGS = {
  letterSize: 110,        // px, letter tile size (drives scatter math)
  slotSize: 120,          // px, slot size
  snapDistance: 80,       // px, magnetic-snap threshold from slot center
  sessionLength: 10,      // words per session before the Win Screen
  showDistractors: false, // MVP: only correct letters are scattered
  enableLetterSpeech: true, // speak the letter ("a!") on a correct snap
  language: 'id-ID',      // TTS locale for Kata (matches Gambar's id-ID)
};

export const KATA_DEFAULT_PROGRESS = {
  completedWords: [],     // array of word ids completed this session
  currentStreak: 0,
  totalSessions: 0,
};

// Starter words: short Indonesian toddler words, spelled exactly as pronounced
// in id-ID so the shared Indonesian TTS voice says them correctly. See ADR 0003.
export const KATA_STARTER_WORDS = [
  { word: 'mama', category: 'keluarga' },
  { word: 'papa', category: 'keluarga' },
  { word: 'kucing', category: 'hewan' },
  { word: 'mobil', category: 'benda' },
  { word: 'bola', category: 'benda' },
  { word: 'buku', category: 'benda' },
  { word: 'susu', category: 'makanan' },
  { word: 'air', category: 'alam' },
  { word: 'mata', category: 'tubuh' },
  { word: 'api', category: 'alam' },
];
