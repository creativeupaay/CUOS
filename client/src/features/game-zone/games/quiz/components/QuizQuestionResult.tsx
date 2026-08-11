import QuizOptionCard from './QuizOptionCard';
import type { QuizCurrentQuestion, QuizQuestionResult } from '../types/quiz.types';
import { CheckCircle2, XCircle, Clock, Info } from 'lucide-react';

interface QuizQuestionResultViewProps {
  question: QuizCurrentQuestion;
  result: QuizQuestionResult;
  mySelectedOption: number | null;
  myUserId: string | null;
  nextQuestionCountdown?: number | null;
}

export default function QuizQuestionResultView({
  question,
  result,
  mySelectedOption,
  myUserId,
  nextQuestionCountdown,
}: QuizQuestionResultViewProps) {
  const myResult = result.results.find((r) => r.userId === myUserId || (myUserId && r.userId?.toString() === myUserId.toString()));
  
  // Robust correctness check: check server result first, or fallback to matching mySelectedOption with result.correctOption
  const isCorrect = myResult?.isCorrect === true || (mySelectedOption !== null && mySelectedOption === result.correctOption);
  const noAnswer = mySelectedOption === null;
  const isDefinitelyWrong = !isCorrect && !noAnswer;

  // Score change to display
  const pointsGained = myResult?.scoreChange || (isCorrect ? 500 : 0);

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full relative z-10 space-y-5 md:space-y-6">
      {/* Sleek Merged Result Banner + Countdown Badge */}
      <div 
        className={`flex flex-col sm:flex-row items-center justify-between p-4 px-5 rounded-2xl text-white shadow-xl transition-all duration-300 border-2 gap-3 ${
          isCorrect 
            ? 'bg-gradient-to-r from-emerald-700/90 via-emerald-800/90 to-emerald-950/90 border-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
            : noAnswer 
              ? 'bg-gradient-to-r from-slate-700/90 via-slate-800/90 to-slate-950/90 border-slate-500 shadow-md' 
              : isDefinitelyWrong
                ? 'bg-gradient-to-r from-rose-700/90 via-rose-800/90 to-rose-950/90 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-gradient-to-r from-slate-700/90 via-slate-800/90 to-slate-950/90 border-slate-500 shadow-md'
        }`}
      >
        {/* Left: Result Badge */}
        {isCorrect ? (
          <div className="flex items-center gap-2.5 text-base sm:text-lg font-black uppercase tracking-wider drop-shadow-md">
            <CheckCircle2 size={24} className="text-white animate-pop-in shrink-0" />
            <span>CORRECT!</span>
            <span className="ml-1 text-amber-300 bg-black/40 px-2.5 py-1 rounded-lg border border-amber-400/40 text-xs sm:text-sm font-black">
              +{pointsGained} PTS
            </span>
          </div>
        ) : noAnswer ? (
          <div className="flex items-center gap-2.5 text-base sm:text-lg font-black uppercase tracking-wider drop-shadow-md">
            <Clock size={24} className="text-slate-300 shrink-0" />
            <span>TIME'S UP!</span>
            <span className="ml-1 text-slate-300 bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 text-xs sm:text-sm font-black">
              0 PTS
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-base sm:text-lg font-black uppercase tracking-wider drop-shadow-md">
            <XCircle size={24} className="text-white animate-pop-in shrink-0" />
            <span>INCORRECT!</span>
            <span className="ml-1 text-rose-300 bg-black/40 px-2.5 py-1 rounded-lg border border-rose-500/40 text-xs sm:text-sm font-black">
              {myResult?.scoreChange || -100} PTS
            </span>
          </div>
        )}

        {/* Right: Next Question Countdown Badge */}
        <div className="bg-black/50 px-3.5 py-1.5 rounded-xl border border-white/20 flex items-center gap-2 shrink-0 shadow-inner">
          <Clock size={15} className="text-cyan-400 animate-spin shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-300">Next Q In:</span>
          <span className="text-base font-black text-cyan-300 tabular-nums animate-pulse">
            {nextQuestionCountdown !== undefined && nextQuestionCountdown !== null ? nextQuestionCountdown : 5}s
          </span>
        </div>
      </div>

      {/* Question Text Box - Sleek & Readable */}
      <div className="game-glass-panel p-4 sm:p-5 rounded-2xl text-center relative animate-fade-slide-up shadow-xl border border-white/10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full shadow-[0_0_12px_rgba(168,85,247,0.6)] border border-white/20">
          QUESTION {question.questionNumber}
        </div>
        <h2 className="text-base sm:text-lg font-bold leading-relaxed text-white drop-shadow-sm pt-1 tracking-wide">
          {question.question}
        </h2>
      </div>

      {/* Options with Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {question.options.map((optionText, index) => (
          <QuizOptionCard
            key={`res-${question.questionId}-opt-${index}`}
            index={index}
            text={optionText}
            isSelected={mySelectedOption === index}
            isCorrect={index === result.correctOption}
            isDisabled={true}
            onSelect={() => {}}
            showResult={true}
          />
        ))}
      </div>

      {/* Explanation */}
      <div className="game-glass-panel bg-gradient-to-r from-cyan-950/40 via-black/50 to-purple-950/40 border-l-4 border-l-cyan-400 rounded-2xl p-5 sm:p-6 text-white animate-fade-slide-up shadow-xl border border-white/10">
        <h3 className="font-black text-cyan-300 flex items-center gap-2 mb-2 uppercase tracking-wider text-xs sm:text-sm">
          <Info size={16} className="text-cyan-400 shrink-0" />
          AI Explanation
        </h3>
        <p className="text-sm sm:text-base leading-relaxed font-semibold text-slate-200">
          {result.explanation}
        </p>
      </div>
    </div>
  );
}
