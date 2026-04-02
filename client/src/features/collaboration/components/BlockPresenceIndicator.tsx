import React from 'react';
import type { UserPresence } from '../types/types';
import { User } from 'lucide-react';

interface BlockPresenceIndicatorProps {
  user: UserPresence | null;
}

export const BlockPresenceIndicator: React.FC<BlockPresenceIndicatorProps> = ({ user }) => {
  if (!user) {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full shadow-sm z-10 animate-pulse"
      style={{ backgroundColor: `${user.color}20`, borderColor: user.color, borderWidth: '1px' }}
    >
      {/* Pulsing dot */}
      <div
        className="w-2 h-2 rounded-full animate-pulse"
        style={{ backgroundColor: user.color }}
      />

      {/* User avatar */}
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
        style={{
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
          <User size={12} />
        )}
      </div>

      {/* User name */}
      <span className="text-xs font-medium" style={{ color: user.color }}>
        {user.userName}
      </span>
    </div>
  );
};

export default BlockPresenceIndicator;
