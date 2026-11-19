import React from 'react';

interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`flex border-b border-slate-800/80 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 py-3.5 px-4 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:text-violet-400 ${
              isActive
                ? 'text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            )}
            {/* Active underline pill */}
            {isActive && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};
