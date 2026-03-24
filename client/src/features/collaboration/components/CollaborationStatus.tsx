import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface CollaborationStatusProps {
  isConnected: boolean;
  isSyncing?: boolean;
}

export const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  isConnected,
  isSyncing = false,
}) => {
  if (isConnected && !isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
        <Wifi size={14} />
        <span>Live</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
        <RefreshCw size={14} className="animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
      <WifiOff size={14} />
      <span>Offline</span>
    </div>
  );
};

export default CollaborationStatus;
