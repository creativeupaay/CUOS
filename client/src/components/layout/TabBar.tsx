import { useRef, useEffect } from 'react';
import { useAppSelector } from '@/app/hooks';

import { useWorkspaceTabsManager } from '@/hooks/useWorkspaceTabsManager';
import { X, Pin, ChevronLeft, ChevronRight, ListX } from 'lucide-react';

export default function TabBar() {
    const { tabs, activeTabId } = useAppSelector(state => state.workspace);
    const { switchTab, closeTab, clearAll } = useWorkspaceTabsManager();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active tab when it changes
    useEffect(() => {
        if (!scrollContainerRef.current || !activeTabId) return;
        const activeEl = scrollContainerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement;
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeTabId, tabs.length]);

    const handleClose = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        closeTab(id);
    };

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const amount = 200;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -amount : amount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div 
            className="flex items-center h-10 w-full bg-gray-50/80 border-b border-gray-200 print:hidden shrink-0 px-2 select-none"
            style={{ 
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
            }}
        >
            <button 
                onClick={() => scroll('left')}
                className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 shrink-0"
            >
                <ChevronLeft size={16} />
            </button>

            <div 
                ref={scrollContainerRef}
                className="flex items-end h-full flex-1 overflow-x-auto hide-scrollbar scroll-smooth gap-1 pt-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <style>{`
                    .hide-scrollbar::-webkit-scrollbar { display: none; }
                `}</style>
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTabId;
                    return (
                        <div
                            key={tab.id}
                            data-tab-id={tab.id}
                            onClick={() => switchTab(tab.id)}
                            className={`group relative flex items-center h-full min-w-[120px] max-w-[200px] px-3 py-1.5 cursor-pointer border-t border-x rounded-t-lg transition-colors ${
                                isActive 
                                    ? 'bg-white border-gray-200 text-primary z-10 before:absolute before:bottom-[-1px] before:left-0 before:right-0 before:h-[2px] before:bg-white' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
                            }`}
                        >
                            {/* Pin Icon if Pinned */}
                            {tab.isPinned && (
                                <Pin size={12} className={`mr-2 shrink-0 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                            )}
                            
                            {/* Title */}
                            <span className="truncate text-xs font-medium flex-1">
                                {tab.title}
                            </span>
                            
                            {/* Close Button */}
                            {!tab.isPinned && (
                                <button 
                                    onClick={(e) => handleClose(e, tab.id)}
                                    className={`ml-2 p-0.5 rounded-md hover:bg-gray-300/50 transition-colors ${
                                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <button 
                onClick={() => scroll('right')}
                className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 shrink-0"
            >
                <ChevronRight size={16} />
            </button>

            <div className="h-4 w-px bg-gray-300 mx-2 shrink-0" />

            <button
                onClick={clearAll}
                className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600 shrink-0 flex items-center gap-1 text-xs font-medium"
                title="Close All Tabs"
            >
                <ListX size={16} />
            </button>
        </div>
    );
}
