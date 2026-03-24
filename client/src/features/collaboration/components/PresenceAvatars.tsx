import React, { useEffect, useRef, useState } from 'react';
import type { UserPresence } from '../types/types';
import { User } from 'lucide-react';

interface PresenceAvatarsProps {
  users: UserPresence[];
  maxDisplay?: number;
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({
  users,
  maxDisplay = 5,
}) => {
  const [isListOpen, setIsListOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!popupRef.current) return;
      if (!popupRef.current.contains(event.target as Node)) {
        setIsListOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (users.length === 0) {
    return null;
  }

  const displayUsers = users.slice(0, maxDisplay);
  const additionalCount = users.length - maxDisplay;

  return (
    <div className="relative flex items-center gap-1" ref={popupRef}>
      {displayUsers.map((user) => (
        <div
          key={user.socketId}
          className="relative group"
          title={user.userName}
        >
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium border-2 transition-all hover:scale-110"
            style={{
              borderColor: user.color,
              backgroundColor: user.userPhoto ? 'transparent' : user.color,
            }}
          >
            {user.userPhoto ? (
              <img
                src={user.userPhoto}
                alt={user.userName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User size={16} />
            )}
          </div>

          {/* Tooltip (below avatar) */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {user.userName}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900"
              style={{ clipPath: 'polygon(50% 0, 0 100%, 100% 100%)' }}
            />
          </div>
        </div>
      ))}

      {additionalCount > 0 && (
        <button
          type="button"
          onClick={() => setIsListOpen((prev) => !prev)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-700 text-xs font-medium border-2 border-gray-300 bg-gray-100"
          title={`${additionalCount} more user${additionalCount > 1 ? 's' : ''}`}
        >
          +{additionalCount}
        </button>
      )}

      {isListOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-64 rounded-lg border shadow-lg p-2 z-20"
          style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
        >
          <p className="text-xs font-semibold px-2 pb-2" style={{ color: 'var(--color-text-muted)' }}>
            Active in this note ({users.length})
          </p>
          <div className="max-h-52 overflow-y-auto">
            {users.map((user) => (
              <div key={user.socketId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-black/5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                  style={{ backgroundColor: user.userPhoto ? 'transparent' : user.color }}
                >
                  {user.userPhoto ? (
                    <img src={user.userPhoto} alt={user.userName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User size={12} />
                  )}
                </div>
                <span className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {user.userName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PresenceAvatars;
