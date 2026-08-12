import type { GameDefinition } from '../types/gameZone.types';

/**
 * Game Registry
 *
 * Central source of truth for all available games.
 * Adding a new game = create its module + add one entry here.
 * The GamesPage reads from this registry and never needs to know game-specific details.
 */

export const GAME_REGISTRY: GameDefinition[] = [
  {
    id: 'imposter',
    name: 'Imposter',
    shortDescription: 'Find the imposters among your teammates. Give clues. Discuss. Vote wisely.',
    longDescription:
      'A social deduction game where most players share a secret word, but imposters must blend in without knowing it. Give clues, discuss who seems suspicious, and vote to eliminate the imposters before they take over.',
    minPlayers: 4,
    maxPlayers: 20,
    durationMin: 15,
    durationMax: 30,
    difficulty: 'Medium',
    tags: ['Multiplayer', 'Team Strategy', 'Deduction', 'Social'],
    route: '/games/imposter',
    createRoute: '/games/imposter/create',
    available: true,
    icon: '🎭',
    accentColor: '#7C3AED', // purple
  },
  {
    id: 'wordle',
    name: 'Wordle Battle',
    shortDescription: 'Competitive multiplayer word guessing — same word, everyone races.',
    longDescription:
      'A fast-paced multiplayer version of Wordle. Everyone gets the same 5-letter word to guess. Solve it faster and with fewer guesses to earn more points across multiple rounds.',
    minPlayers: 2,
    maxPlayers: 20,
    durationMin: 5,
    durationMax: 15,
    difficulty: 'Medium',
    tags: ['Multiplayer', 'Speed', 'Puzzle', 'Words'],
    route: '/games/wordle',
    createRoute: '/games/wordle',
    available: true,
    icon: '🔤',
    accentColor: '#059669', // emerald green
  },
  {
    id: 'quiz',
    name: 'Quiz Battle',
    shortDescription: 'Real-time AI-generated multiplayer trivia on any topic.',
    longDescription: 'Test your knowledge on literally any topic against your colleagues! Our AI generates unique questions on the fly, and you earn points for speed and accuracy.',
    minPlayers: 2,
    maxPlayers: 50,
    durationMin: 5,
    durationMax: 15,
    difficulty: 'Medium',
    tags: ['Trivia', 'Fast-Paced', 'AI-Generated'],
    route: '/games',
    createRoute: '/games/quiz/create',
    available: true,
    icon: '🧠',
    accentColor: '#8B5CF6',
  },
];

export function getGameById(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
