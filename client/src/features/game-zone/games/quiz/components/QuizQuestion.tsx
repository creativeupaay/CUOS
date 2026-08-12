import { useEffect, useState } from 'react';
import QuizOptionCard from './QuizOptionCard';
import QuizTimer from './QuizTimer';
import QuizRoundProgress from './QuizRoundProgress';
import type { QuizCurrentQuestion } from '../types/quiz.types';
import { Lock } from 'lucide-react';

interface QuizQuestionProps {
  question: QuizCurrentQuestion;
  timePerQuestion: number;
  mySelectedOption: number | null;
  myAnswerLocked: boolean;
  onSelectOption: (optionIndex: number, submissionId: string) => void;
}

export default function QuizQuestion({
  question,
  timePerQuestion,
  mySelectedOption,
  myAnswerLocked,
  onSelectOption,
}: QuizQuestionProps) {
  const [submissionId, setSubmissionId] = useState('');

  useEffect(() => {
    setSubmissionId(Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
  }, [question.questionId]);

  const handleSelect = (index: number) => {
    if (myAnswerLocked) return;
    onSelectOption(index, submissionId);
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full relative z-20 space-y-5 md:space-y-6">
      {/* Header Area */}
      <div className="flex justify-between items-center bg-black/40 p-4 sm:p-5 rounded-2xl border border-white/10 shadow-inner">
        <div className="flex-1 pr-4 border-r border-white/10">
          <QuizRoundProgress 
            currentRound={question.questionNumber} 
            totalRounds={question.totalQuestions} 
          />
          <div className="flex items-center gap-2 mt-2.5 text-xs font-black uppercase tracking-wider">
            <span className="bg-purple-500/20 text-purple-300 px-3 py-0.5 rounded-lg border border-purple-400/30">
              {question.category}
            </span>
            <span className="bg-cyan-500/20 text-cyan-300 px-3 py-0.5 rounded-lg border border-cyan-400/30">
              {question.difficulty}
            </span>
          </div>
        </div>
        
        <div className="shrink-0 pl-4 flex items-center justify-center">
          <QuizTimer 
            endsAt={question.endsAt} 
            timePerQuestion={timePerQuestion} 
            size="large"
          />
        </div>
      </div>

      {/* Question Text Box - Sleek & Readable */}
      <div className="game-glass-panel p-4 sm:p-5 rounded-2xl text-center relative animate-fade-slide-up shadow-xl border border-white/10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-gradient-to-r from-pink-500 via-rose-600 to-purple-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full shadow-[0_0_12px_rgba(236,72,153,0.6)] border border-white/20">
          QUESTION {question.questionNumber}
        </div>
        <h2 className="text-base sm:text-lg font-bold leading-relaxed text-white drop-shadow-sm pt-1 tracking-wide">
          {question.question}
        </h2>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch relative z-30">
        {question.options.map((optionText, index) => (
          <QuizOptionCard
            key={`${question.questionId}-opt-${index}`}
            index={index}
            text={optionText}
            isSelected={mySelectedOption === index}
            isDisabled={myAnswerLocked}
            onSelect={() => handleSelect(index)}
            showResult={false}
          />
        ))}
      </div>

      {/* Locked Status */}
      {myAnswerLocked && (
        <div className="flex items-center justify-center gap-3 p-3.5 game-glass-panel rounded-2xl text-cyan-300 border-cyan-400/40 shadow-xl animate-fade-slide-up">
          <Lock size={20} className="text-cyan-400 shrink-0 animate-pulse" />
          <span className="font-extrabold text-sm uppercase tracking-wider text-white">ANSWER LOCKED IN!</span>
          <span className="text-xs text-slate-300 font-medium hidden sm:inline">— Waiting for other players...</span>
        </div>
      )}
    </div>
  );
}
