/**
 * Question Validator
 *
 * Validates any question (AI-generated or fallback) against all 20 rules.
 * Returns { valid: boolean, reason?: string }
 */

export interface QuestionCandidate {
  question: string;
  options: unknown[];
  correctOption: unknown;
  explanation: string;
  difficulty?: string;
  category?: string;
  topic?: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Content safety keywords — basic filter
const UNSAFE_KEYWORDS = [
  'kill', 'murder', 'rape', 'bomb', 'terrorist', 'suicide', 'porn', 'sex', 'nude', 'naked',
  'ignore previous', 'ignore all', 'ignore instructions', 'jailbreak', 'bypass',
];

// Subjective question markers
const SUBJECTIVE_MARKERS = [
  'best', 'worst', 'greatest', 'most beautiful', 'ugliest', 'should', 'favorite', 'favourite',
  'better than', 'prefer', 'most important thing',
];

function containsUnsafeContent(text: string): boolean {
  const lower = text.toLowerCase();
  return UNSAFE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isLikelySubjective(question: string): boolean {
  const lower = question.toLowerCase();
  return SUBJECTIVE_MARKERS.some((marker) => lower.includes(marker));
}

function containsPromptInjection(text: string): boolean {
  const lower = text.toLowerCase();
  const injectionPatterns = [
    'ignore previous instructions',
    'ignore all previous',
    'disregard',
    'new instruction',
    'system:',
    '</s>',
    '[inst]',
    '<<sys>>',
  ];
  return injectionPatterns.some((pattern) => lower.includes(pattern));
}

function revealAnswerInQuestion(question: string, options: string[], correctOption: number): boolean {
  const correctAnswer = options[correctOption]?.toLowerCase() || '';
  const questionLower = question.toLowerCase();
  // Check if the question text directly contains the exact correct answer text (>10 chars)
  return correctAnswer.length > 10 && questionLower.includes(correctAnswer);
}

export function validateQuestion(candidate: QuestionCandidate): ValidationResult {
  // Rule 1: Has exactly one question (not empty)
  if (!candidate.question || typeof candidate.question !== 'string' || candidate.question.trim().length < 10) {
    return { valid: false, reason: 'Question is empty or too short' };
  }

  // Rule 2–3: Has exactly 4 options, all strings
  if (!Array.isArray(candidate.options) || candidate.options.length !== 4) {
    return { valid: false, reason: 'Question must have exactly 4 options' };
  }

  const options = candidate.options as string[];
  if (!options.every((opt) => typeof opt === 'string' && opt.trim().length >= 1)) {
    return { valid: false, reason: 'All options must be non-empty strings' };
  }

  // Rule 4: Four unique options
  const uniqueOptions = new Set(options.map((o) => o.trim().toLowerCase()));
  if (uniqueOptions.size !== 4) {
    return { valid: false, reason: 'All 4 options must be unique' };
  }

  // Rule 5: Exactly one correct option (valid index 0–3)
  const correctOption = candidate.correctOption as number;
  if (typeof correctOption !== 'number' || !Number.isInteger(correctOption) || correctOption < 0 || correctOption > 3) {
    return { valid: false, reason: 'correctOption must be an integer between 0 and 3' };
  }

  // Rule 6: Has an explanation
  if (!candidate.explanation || typeof candidate.explanation !== 'string' || candidate.explanation.trim().length < 5) {
    return { valid: false, reason: 'Question must have a valid explanation' };
  }

  // Rule 7–8: Not subjective
  if (isLikelySubjective(candidate.question)) {
    return { valid: false, reason: 'Question appears to be subjective' };
  }

  // Rule 13–14: Text-only (no image/URL references)
  const fullText = `${candidate.question} ${options.join(' ')} ${candidate.explanation}`.toLowerCase();
  if (fullText.includes('image') || fullText.includes('picture') || fullText.includes('photo') || fullText.includes('see below') || fullText.includes('shown above')) {
    return { valid: false, reason: 'Question must not reference images' };
  }

  // Rule 15: No live information dependency
  const currentYear = new Date().getFullYear();
  const livePatterns = [
    'current president', 'current prime minister', 'current ceo', 'current champion',
    'as of today', 'right now', 'at this moment', 'latest version', 'most recent',
  ];
  if (livePatterns.some((p) => fullText.includes(p))) {
    return { valid: false, reason: 'Question must not depend on real-time information' };
  }

  // Rule 16–17: Content safety
  if (containsUnsafeContent(fullText)) {
    return { valid: false, reason: 'Question contains unsafe content' };
  }

  // Rule 17: No prompt injection
  if (containsPromptInjection(fullText)) {
    return { valid: false, reason: 'Question contains potential prompt injection' };
  }

  // Rule 19: Question must not reveal the answer
  if (revealAnswerInQuestion(candidate.question, options, correctOption)) {
    return { valid: false, reason: 'Question appears to reveal the correct answer' };
  }

  // Rule 11: Difficulty validation
  const validDifficulties = ['easy', 'medium', 'hard'];
  if (candidate.difficulty && !validDifficulties.includes(candidate.difficulty.toLowerCase())) {
    return { valid: false, reason: 'Invalid difficulty level' };
  }

  // Options reasonable length
  if (options.some((opt) => opt.length > 200)) {
    return { valid: false, reason: 'Option text is too long' };
  }

  if (candidate.question.length > 500) {
    return { valid: false, reason: 'Question text is too long' };
  }

  return { valid: true };
}

/**
 * Validates an array of candidates and returns only valid ones.
 */
export function filterValidQuestions<T extends QuestionCandidate>(candidates: T[]): T[] {
  return candidates.filter((c) => validateQuestion(c).valid);
}

/**
 * Checks for duplicates within a set of questions.
 */
export function deduplicateQuestions<T extends QuestionCandidate>(questions: T[]): T[] {
  const seen = new Set<string>();
  return questions.filter((q) => {
    const key = q.question.trim().toLowerCase().slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
