import React from 'react';
import { X, Bell, Trash2, Volume2, VolumeX, Inbox, CheckCircle2 } from 'lucide-react';

const GlobalNotificationsModal = ({ isOpen, onClose, notifications, soundEnabled, onToggleSound, onClearLog }) => {
  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="glass-card w-full max-w-lg mx-4 flex flex-col overflow-hidden text-white animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(10, 22, 40, 0.95)',
          border: '1px solid rgba(255, 77, 109, 0.25)',
          boxShadow: '0 0 30px rgba(255, 77, 109, 0.08), 0 20px 50px rgba(0, 0, 0, 0.8)',
          maxHeight: '85vh'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1E2D4A] bg-[#070F1C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20">
              <Bell className="w-4 h-4 text-[#FF4D6D]" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wider uppercase text-[#FF4D6D]">Triggered Signals Log</h2>
              <p className="text-[10px] text-[#8BAFC8]">Live breach history activity log</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar (Sound Toggle & Clear Actions) */}
        <div className="p-4 border-b border-[#1E2D4A] bg-[#050B14] flex items-center justify-between gap-4">
          <button 
            onClick={onToggleSound}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors font-bold"
            style={{ color: soundEnabled ? '#FFD700' : '#8BAFC8' }}
            title={soundEnabled ? "Mute alert sound" : "Unmute alert sound"}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-[#FFD700]" />
                <span>Audio: Enabled</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-gray-500" />
                <span className="text-gray-400">Audio: Muted</span>
              </>
            )}
          </button>

          {notifications.length > 0 && (
            <button 
              onClick={onClearLog}
              className="text-xs text-red-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Log</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[350px] min-h-[180px]">
          {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#4A6080] py-8">
              <Inbox className="w-8 h-8 mb-2 opacity-40 text-gray-500" />
              <span className="text-xs">No alert signals logged yet.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {notifications.map((notif, idx) => (
                <div 
                  key={notif.id || idx} 
                  className="flex items-start gap-3 p-3 rounded-lg border border-[#1E2D4A] bg-[#070F1C]/20 hover:bg-[#070F1C]/60 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 mt-0.5 flex-shrink-0">
                    <Bell className="w-3.5 h-3.5 text-[#FF4D6D]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="font-bold text-xs font-mono text-white">{notif.ticker}/USD</span>
                      <span className="text-[9px] text-[#4A6080] font-mono">
                        {formatDate(notif.timestamp)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8BAFC8] leading-tight">
                      {notif.title}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-center flex-shrink-0 text-cyan-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00E5A0]" />
                    <span className="text-[9px] font-bold text-[#00E5A0]">Delivered</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalNotificationsModal;
