import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../../../config/env.config';
import { logger } from '../../../../utils/logger';
import { validateQuestion, deduplicateQuestions } from '../../utils/quiz/questionValidator';
import type { ValidatedQuestion } from '../../types/quiz.types';
import type { QuizDifficulty } from '../../models/QuizSession.model';

interface AIQuestion {
  question: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
  difficulty: string;
  category: string;
}

const GENERATION_TIMEOUT_MS = 30000; // 30 seconds

function sanitizeTopic(topic: string): string {
  return topic
    .replace(/[^a-zA-Z0-9 \-_'.(),&]/g, '')
    .trim()
    .slice(0, 100);
}

function getDifficultyInstruction(difficulty: QuizDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Generate straightforward questions that most people with basic knowledge can answer. Avoid obscure facts.';
    case 'medium':
      return 'Generate questions requiring reasonable knowledge of the topic. Not trivial, but not too specialized.';
    case 'hard':
      return 'Generate challenging questions requiring strong knowledge. Use specific details, dates, or technical concepts.';
    case 'mixed':
      return 'Generate a balanced mix: approximately 30% easy, 50% medium, 20% hard questions.';
    default:
      return 'Generate medium-difficulty questions.';
  }
}

function buildPrompt(sanitizedTopic: string, count: number, difficulty: QuizDifficulty): string {
  const difficultyInstruction = getDifficultyInstruction(difficulty);

  return `You are a quiz question generator. Generate exactly ${count} multiple-choice quiz questions about the topic: "${sanitizedTopic}".

${difficultyInstruction}

STRICT REQUIREMENTS:
1. Each question must be objective with exactly ONE correct answer
2. Questions must be about "${sanitizedTopic}" only
3. Each question must have exactly 4 distinct options
4. Questions must be text-only (no images, URLs, or external references)
5. Questions must not be subjective (no "best", "greatest", "most beautiful" type questions)
6. Questions must not depend on real-time data (no "current president" type questions)
7. The correct answer must not be revealed in the question text
8. All options must be meaningfully different (no near-duplicates)
9. Questions must be appropriate for a professional workplace

Respond ONLY with a valid JSON array. No markdown, no explanation, just raw JSON:
[
  {
    "question": "Full question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctOption": 0,
    "explanation": "Brief explanation of why the answer is correct.",
    "difficulty": "easy|medium|hard",
    "category": "Topic category name"
  }
]

The "correctOption" field must be the 0-based index of the correct option in the options array.
Generate exactly ${count} questions.`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`AI generation timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

export async function generateQuestionsWithAI(
  topic: string,
  count: number,
  difficulty: QuizDifficulty,
  maxRetries = 3
): Promise<ValidatedQuestion[]> {
  if (!env.GEMINI_API_KEY) {
    logger.warn('[QuizAI] GEMINI_API_KEY not configured — skipping AI generation');
    return [];
  }

  const sanitizedTopic = sanitizeTopic(topic);
  if (!sanitizedTopic) {
    logger.warn('[QuizAI] Topic sanitization resulted in empty string');
    return [];
  }

  const candidateCount = Math.ceil(count * 1.5);
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

  const MODEL_NAMES = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-pro',
    'gemini-3.0-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-pro',
  ];

  const prompt = buildPrompt(sanitizedTopic, candidateCount, difficulty);

  for (const modelName of MODEL_NAMES) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[QuizAI] Generating ${candidateCount} questions for topic "${sanitizedTopic}" using ${modelName} (attempt ${attempt}/${maxRetries})`);

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        });

        const result = await withTimeout(
          model.generateContent(prompt),
          GENERATION_TIMEOUT_MS
        );

        const text = result.response.text().trim();

        let cleaned = text;
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        let parsed: AIQuestion[];
        try {
          const rawParsed = JSON.parse(cleaned);
          if (!Array.isArray(rawParsed)) {
            throw new Error('Response is not an array');
          }
          parsed = rawParsed;
        } catch (parseErr: any) {
          logger.warn({ parseErr }, `[QuizAI] Failed to parse JSON with ${modelName} on attempt ${attempt}`);
          if (attempt < maxRetries) {
            await sleep(1000 * attempt);
            continue;
          }
          break;
        }

        // Validate each question
        const validated: ValidatedQuestion[] = [];
        for (const q of parsed) {
          const res = validateQuestion({
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            difficulty: q.difficulty,
            category: q.category,
            topic: sanitizedTopic,
          });

          if (res.valid) {
            validated.push({
              question: q.question.trim(),
              options: [
                q.options[0].trim(),
                q.options[1].trim(),
                q.options[2].trim(),
                q.options[3].trim(),
              ],
              correctOption: q.correctOption,
              explanation: q.explanation.trim(),
              topic: sanitizedTopic,
              category: q.category || sanitizedTopic,
              difficulty: (['easy', 'medium', 'hard'].includes(q.difficulty?.toLowerCase())
                ? q.difficulty.toLowerCase()
                : 'medium') as 'easy' | 'medium' | 'hard',
              source: 'ai',
            });
          } else {
            logger.debug(`[QuizAI] Rejected question: ${res.reason}`);
          }
        }

        // Deduplicate
        const deduped = deduplicateQuestions(validated);
        if (deduped.length > 0) {
          logger.info(`[QuizAI] Generated ${deduped.length} valid questions from ${parsed.length} candidates using ${modelName}`);
          return deduped;
        }
      } catch (err: any) {
        logger.warn({ err: err.message }, `[QuizAI] Error on attempt ${attempt}/${maxRetries} with ${modelName}`);
        if (attempt < maxRetries) {
          await sleep(1500 * attempt);
        }
      }
    }
  }

  logger.warn('[QuizAI] All model attempts exhausted — returning empty result');
  return [];
}
