/**
 * Word packs for the Imposter game.
 * Each pack contains an array of words. The server randomly selects from the pack.
 * Words should be common nouns / concepts that are easy to describe with one word.
 */

const WORD_PACKS: Record<string, string[]> = {
  general: [
    'COFFEE', 'PIZZA', 'BEACH', 'GUITAR', 'CLOUD', 'LIBRARY', 'SUNRISE', 'HOSPITAL',
    'BICYCLE', 'FOREST', 'OCEAN', 'CAMERA', 'AIRPORT', 'MUSEUM', 'MARKET',
    'FIREPLACE', 'GARDEN', 'UMBRELLA', 'CONCERT', 'PASSPORT', 'MOUNTAIN', 'DOLPHIN',
    'TELESCOPE', 'LIGHTHOUSE', 'WATERFALL', 'TORNADO', 'AVALANCHE', 'VOLCANO',
    'DIAMOND', 'CHOCOLATE', 'THUNDER', 'RAINBOW', 'ICEBERG', 'COMPASS', 'LANTERN',
    'ACCORDION', 'SUBMARINE', 'CATHEDRAL', 'ELEVATOR', 'MICROSCOPE', 'PENDULUM',
    'QUICKSAND', 'HAMMOCK', 'FJORD', 'BAZAAR', 'CAROUSEL', 'LABYRINTH',
    'EXPEDITION', 'MIRAGE', 'SILHOUETTE',
  ],
  food: [
    'SUSHI', 'BURGER', 'TACOS', 'PASTA', 'RAMEN', 'CURRY', 'STEAK', 'PANCAKES',
    'WAFFLE', 'CHEESECAKE', 'TIRAMISU', 'CROISSANT', 'SAMOSA', 'DUMPLINGS',
    'LASAGNA', 'BIRYANI', 'PAELLA', 'FONDUE', 'RISOTTO', 'BRUSCHETTA',
  ],
  office: [
    'DEADLINE', 'MEETING', 'PRESENTATION', 'SPREADSHEET', 'BRAINSTORM',
    'WHITEBOARD', 'CONFERENCE', 'STARTUP', 'FEEDBACK', 'PROTOTYPE',
    'WORKFLOW', 'DASHBOARD', 'MILESTONE', 'SYNERGY', 'PIVOT', 'ROADMAP',
    'STANDUP', 'RETROSPECTIVE', 'SPRINT', 'BACKLOG',
  ],
  nature: [
    'AURORA', 'GLACIER', 'MANGROVE', 'DESERT', 'TUNDRA', 'SAVANNA',
    'CANYON', 'GEYSER', 'LAGOON', 'ESTUARY', 'PENINSULA', 'ARCHIPELAGO',
    'MONSOON', 'ECLIPSE', 'METEOR', 'NEBULA', 'CORAL', 'BAMBOO', 'REDWOOD',
  ],
};

/**
 * Get a random word from a word pack.
 * Throws if the pack does not exist.
 */
export function getRandomWord(packName: string = 'general'): string {
  const pack = WORD_PACKS[packName] || WORD_PACKS['general'];
  return pack[Math.floor(Math.random() * pack.length)];
}

/**
 * Get available word pack names.
 */
export function getWordPackNames(): string[] {
  return Object.keys(WORD_PACKS);
}

export { WORD_PACKS };
