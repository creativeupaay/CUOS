import { useState } from 'react';
import { HelpCircle, Info, X } from 'lucide-react';

export default function QuizScoringInfo() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-cyan-300 transition-all bg-black/40 hover:bg-black/60 px-3 py-1 rounded-lg border border-white/15 shadow-sm cursor-pointer"
        title="View scoring system rules"
      >
        <HelpCircle size={14} className="text-cyan-400" />
        <span>How scoring works</span>
      </button>
      
      {isOpen && (
        <>
          {/* Transparent Backdrop to close on outside click */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />

          {/* Right-aligned popover modal — opens inward into question area */}
          <div className="absolute top-full right-0 mt-2 w-72 p-4 bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-2xl text-white z-50 animate-fade-slide-up">
            <div className="flex items-center justify-between font-black text-sm border-b border-white/10 pb-2.5 mb-3">
              <div className="flex items-center gap-2 text-cyan-300">
                <Info size={16} className="text-cyan-400 shrink-0" />
                Scoring System
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="text-xs space-y-2 font-bold">
              <div className="flex justify-between items-center bg-emerald-500/15 p-2 px-2.5 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-400">Correct Answer</span>
                <span className="text-emerald-300 font-black">+500 pts</span>
              </div>
              
              <div className="bg-purple-500/15 p-2.5 rounded-xl border border-purple-400/30 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-purple-300">Speed Bonus</span>
                  <span className="text-purple-200 font-black">Up to +300 pts</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-tight font-medium">
                  Faster answers earn higher speed bonus based on time remaining.
                </p>
              </div>
              
              <div className="flex justify-between items-center bg-rose-500/15 p-2 px-2.5 rounded-xl border border-rose-500/30">
                <span className="text-rose-400">Wrong Answer</span>
                <span className="text-rose-300 font-black">-100 pts</span>
              </div>
              
              <div className="flex justify-between items-center bg-black/40 p-2 px-2.5 rounded-xl border border-white/10">
                <span className="text-slate-400">No Answer (Timeout)</span>
                <span className="text-slate-300 font-black">0 pts</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
