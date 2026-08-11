import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BrainCircuit } from 'lucide-react';
import { useCreateQuizSessionMutation } from '../api/quizApi';
import GameFullscreenWrapper from '../../../components/GameFullscreenWrapper';

const dropdownStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 0.75rem center',
  backgroundSize: '1.1em',
};

export default function CreateQuizPage() {
  const navigate = useNavigate();
  const [createQuiz, { isLoading, error }] = useCreateQuizSessionMutation();

  const [formData, setFormData] = useState({
    gameName: 'Quiz Battle',
    topic: '',
    totalQuestions: 10,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard' | 'mixed',
    timePerQuestion: 20,
    maxPlayers: 20,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic.trim()) return;

    try {
      const result = await createQuiz(formData).unwrap();
      if (result.success && result.data.sessionId) {
        navigate(`/games/quiz/${result.data.sessionId}`);
      }
    } catch (err) {
      console.error('Failed to create quiz:', err);
    }
  };

  return (
    <GameFullscreenWrapper 
      className="theme-game theme-game-bg w-full h-full min-h-[calc(100vh-var(--topbar-height))]"
      contentClassName="flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-2xl game-glass-panel rounded-2xl overflow-hidden animate-fade-slide-up shadow-2xl mx-auto my-auto">
        
        {/* Header - compact */}
        <div className="relative p-4 sm:p-5 text-center border-b border-white/10 bg-black/20 overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-neon-purple opacity-20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-neon-cyan opacity-20 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d946ef] to-[#a21caf] flex items-center justify-center shadow-lg shadow-purple-500/30 border border-white/20 shrink-0">
              <BrainCircuit className="text-white" size={26} />
            </div>
            <div className="text-left">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide leading-tight">
                Host a Quiz Battle
              </h2>
              <p className="text-game-text-secondary text-xs font-medium">
                Configure your AI-powered game arena
              </p>
            </div>
          </div>
        </div>
        
        {/* Form Body */}
        <div className="p-4 sm:p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="p-3 bg-red-900/40 text-red-200 text-sm rounded-xl flex items-start gap-2 border border-red-500/30">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                <p className="font-medium text-sm">{(error as any)?.data?.message || 'Failed to create session'}</p>
              </div>
            )}

            {/* Lobby Name */}
            <div className="space-y-1.5">
              <label htmlFor="gameName" className="block text-xs font-bold uppercase tracking-widest text-game-text-secondary">
                Lobby Name
              </label>
              <input
                id="gameName"
                className="w-full rounded-xl border-2 border-white/10 bg-black/30 px-3 py-2.5 text-base font-bold text-white placeholder:text-gray-500 focus:outline-none focus:border-neon-purple focus:ring-2 focus:ring-neon-purple/20 transition-all"
                value={formData.gameName}
                onChange={(e) => setFormData(prev => ({ ...prev, gameName: e.target.value }))}
                maxLength={80}
                required
              />
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <label htmlFor="topic" className="block text-xs font-bold uppercase tracking-widest text-game-text-secondary">
                Topic <span className="text-neon-pink">*</span>
              </label>
              <textarea
                id="topic"
                placeholder="e.g., European History, JavaScript Basics, Cricket Trivia..."
                value={formData.topic}
                onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                maxLength={100}
                required
                rows={2}
                className="w-full rounded-xl border-2 border-white/10 bg-black/30 px-3 py-2.5 text-base font-medium text-white placeholder:text-gray-500 focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all resize-none"
              />
              <p className="text-xs text-game-text-secondary/80 font-medium flex items-center gap-1.5">
                <BrainCircuit size={11} className="text-neon-cyan" />
                AI generates unique questions on this topic
              </p>
            </div>

            {/* Grid Options - 2x2 */}
            <div className="grid grid-cols-2 gap-3">
              {/* Difficulty */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-game-text-secondary">Difficulty</label>
                <select
                  className="w-full rounded-xl border-2 border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-neon-purple transition-all appearance-none cursor-pointer"
                  value={formData.difficulty}
                  onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value as any }))}
                  style={dropdownStyle}
                >
                  <option value="easy" className="bg-game-surface">Easy (Chill)</option>
                  <option value="medium" className="bg-game-surface">Medium (Standard)</option>
                  <option value="hard" className="bg-game-surface">Hard (Sweaty)</option>
                  <option value="mixed" className="bg-game-surface">Mixed (Chaos)</option>
                </select>
              </div>

              {/* Question Count */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-game-text-secondary">Questions</label>
                <select
                  className="w-full rounded-xl border-2 border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-neon-purple transition-all appearance-none cursor-pointer"
                  value={String(formData.totalQuestions)}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalQuestions: Number(e.target.value) }))}
                  style={dropdownStyle}
                >
                  <option value="5" className="bg-game-surface">5 (Sprint)</option>
                  <option value="10" className="bg-game-surface">10 (Normal)</option>
                  <option value="15" className="bg-game-surface">15 (Long)</option>
                  <option value="20" className="bg-game-surface">20 (Marathon)</option>
                </select>
              </div>

              {/* Time Per Question */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-game-text-secondary">Time / Q</label>
                <select
                  className="w-full rounded-xl border-2 border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-neon-purple transition-all appearance-none cursor-pointer"
                  value={String(formData.timePerQuestion)}
                  onChange={(e) => setFormData(prev => ({ ...prev, timePerQuestion: Number(e.target.value) }))}
                  style={dropdownStyle}
                >
                  <option value="10" className="bg-game-surface">10s (Blitz)</option>
                  <option value="15" className="bg-game-surface">15s (Fast)</option>
                  <option value="20" className="bg-game-surface">20s (Standard)</option>
                  <option value="30" className="bg-game-surface">30s (Thoughtful)</option>
                </select>
              </div>

              {/* Max Players */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-widest text-game-text-secondary">Max Players</label>
                <select
                  className="w-full rounded-xl border-2 border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-neon-purple transition-all appearance-none cursor-pointer"
                  value={String(formData.maxPlayers)}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPlayers: Number(e.target.value) }))}
                  style={dropdownStyle}
                >
                  <option value="10" className="bg-game-surface">10 Players</option>
                  <option value="20" className="bg-game-surface">20 Players</option>
                  <option value="50" className="bg-game-surface">50 Players</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-1">
              <button 
                type="button" 
                className="btn-game btn-game-outline px-5 py-2.5 text-sm"
                onClick={() => navigate('/games')}
              >
                ← Back
              </button>
              
              <button 
                type="submit" 
                className="btn-game btn-game-primary flex-1 py-2.5 text-base animate-pulse-glow"
                disabled={isLoading || !formData.topic.trim()}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <BrainCircuit className="animate-spin" size={18} />
                    Generating...
                  </span>
                ) : (
                  '🎮 Create Game Room'
                )}
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </GameFullscreenWrapper>
  );
}
