import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext.js';
import { Settings, Home, Check, Users, Sliders, ChevronRight } from 'lucide-react';

export interface HeaderProps {
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { currentUser, activeHousehold, allUsers, switchUser, isLoading } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  // Family members list (exclude testing IDs like external hacker)
  const familyUsers = allUsers.filter((u) => u.id !== 'usr-external-999');

  const handleSelectUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      setIsDropdownOpen(false);
      return;
    }
    await switchUser(userId);
    setIsDropdownOpen(false);
  };

  const handleNavigateToSettings = () => {
    setIsDropdownOpen(false);
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  return (
    <header className="relative bg-slate-900/95 backdrop-blur-md text-white py-3 px-4 sm:px-5 border-b border-slate-800/80 z-30 select-none">
      <div className="flex items-center justify-between">
        {/* User Identity & Household */}
        <div className="flex items-center gap-3">
          <img
            src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
            alt={currentUser?.name || 'Foto do Usuário'}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-700/70 shadow-sm"
          />

          <div>
            <h1 className="font-semibold text-base text-slate-100 leading-tight">
              Olá, {currentUser?.name?.split(' ')[0] || 'Usuário'}
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
              <Home className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{activeHousehold?.name || 'Casa Wallace & Gui'}</span>
            </p>
          </div>
        </div>

        {/* Discreet Settings Icon Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="btn-header-settings"
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              isDropdownOpen
                ? 'bg-slate-800 text-blue-400 border-slate-700 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border-slate-800 hover:border-slate-700'
            }`}
            aria-label="Configurações e Gestão da Família"
            title="Configurações e Gestão da Família"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Settings & Family Management Dropdown */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 divide-y divide-slate-800"
              >
                {/* Active User Summary */}
                <div className="pb-3 px-1">
                  <div className="flex items-center gap-3">
                    <img
                      src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={currentUser?.name}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-blue-500/60"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {currentUser?.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {currentUser?.email || 'usuario@casafinance.app'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Family & Profile Switcher */}
                <div className="py-2.5 space-y-1">
                  <div className="px-1.5 pb-1 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Membros da Família
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {familyUsers.length} cadastrados
                    </span>
                  </div>

                  {familyUsers.map((user) => {
                    const isSelected = currentUser?.id === user.id;

                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleSelectUser(user.id)}
                        disabled={isLoading}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 border border-blue-500/40 text-blue-200'
                            : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                          <span className="text-xs font-medium truncate">
                            {user.name}
                          </span>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Household & General Settings Navigation */}
                <div className="pt-2.5 px-1 space-y-1">
                  <button
                    type="button"
                    onClick={handleNavigateToSettings}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                      <span>Gerenciar Casa & Ajustes</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
