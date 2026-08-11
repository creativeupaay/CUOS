import React, { useRef, useState, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface GameFullscreenWrapperProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function GameFullscreenWrapper({ children, className = '', contentClassName = '' }: GameFullscreenWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-[100] theme-game theme-game-bg' : ''} ${className}`}
    >
      {/* Fullscreen Toggle Button */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-[90] p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm border border-white/10 shadow-lg transition-all"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
      
      {/* Scrollable Container */}
      <div className={`flex-1 w-full h-full ${isFullscreen ? 'overflow-y-auto' : ''} ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
