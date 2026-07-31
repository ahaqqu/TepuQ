export const DB_NAME = 'tepuq_db';
export const DB_VERSION = 3;

export const DEFAULT_SETTINGS = {
  backgroundStyle: 'combined',
  globalEntryAnimation: 'random',
  globalExitAnimation: 'random',
  cardSize: 'medium',
  playMode: 'random',
  burstWindow: 1.5,
  debounceMs: 300,
  speechRate: 0.95,
  speechPitch: 1.25,
  volume: 0.8,
  autoSmashDelay: 6,
  enabledModes: ['bebas', 'target'],
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
