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
  // Future games go here:
  // {
  //   id: 'quiz',
  //   name: 'Quiz Battle',
  //   ...
  // }
];

export function getGameById(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
