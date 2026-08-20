import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, CheckCircle2, Search } from 'lucide-react';

export interface SelectOption {
  value: any;
  label: string;
  icon?: React.ReactNode;
  isDestructive?: boolean;
}

export interface SelectProps {
  value: any;
  onChange: (value: any) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchable = false,
  theme = 'light',
  className = '',
  ariaLabel = 'Select option',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const isDark = theme === 'dark';

  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
        setSearchQuery('');
      }
    }
  };

  const triggerDark = `bg-[#2a0808]/90 backdrop-blur-md border border-white/10 px-3 py-2 text-[10px] sm:text-xs font-black text-white uppercase tracking-wider hover:bg-[#3a0a0a] ${
    isOpen ? 'border-red-500 ring-1 ring-red-500/50' : ''
  }`;
  const triggerLight = `bg-white border border-gray-200 px-2.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black uppercase text-gray-700 hover:bg-gray-50 shadow-2xs ${
    isOpen ? 'border-[#5A0000] ring-1 ring-[#5A0000]/30' : ''
  }`;
  const dropdownDark = 'bg-[#1a0505] border border-red-900/40 shadow-2xl';
  const dropdownLight = 'bg-white border border-gray-100 shadow-xl';

  const getOptionClass = (isSelected: boolean, isDestructive?: boolean, isHighlighted?: boolean) => {
    if (isDestructive) {
      return isSelected
        ? 'bg-red-600 text-white'
        : 'text-red-600 hover:bg-red-50 bg-red-50/40';
    }
    if (isDark) {
      if (isSelected) return 'bg-red-500/20 text-red-400 font-black';
      if (isHighlighted) return 'bg-[#2a0808] text-white';
      return 'text-gray-300 hover:bg-[#2a0808] hover:text-white';
    }
    if (isSelected) return 'bg-red-50 text-[#5A0000] font-black';
    if (isHighlighted) return 'bg-gray-100 text-gray-900';
    return 'text-gray-700 hover:bg-gray-50';
  };

  return (
    <div
      className={`relative w-full ${isOpen ? 'z-[100]' : 'z-10'} ${className}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full cursor-pointer select-none transition-all rounded-lg sm:rounded-xl outline-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isDark ? triggerDark : triggerLight}`}
      >
        <div className="flex items-center gap-1.5 truncate pr-2">
          {selectedOption?.icon}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          } ${isDark ? 'text-gray-400' : 'text-gray-400'}`}
        />
      </div>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute top-[calc(100%+4px)] left-0 min-w-full w-max max-w-[280px] sm:max-w-xs rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-[9999] ${
            isDark ? dropdownDark : dropdownLight
          }`}
        >
          {searchable && (
            <div className={`p-1.5 border-b ${isDark ? 'border-red-900/30' : 'border-gray-100'}`}>
              <div className="relative flex items-center">
                <Search className="w-3 h-3 absolute left-2 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-6 pr-2 py-1 text-[10px] sm:text-xs rounded-md font-bold outline-none ${
                    isDark
                      ? 'bg-[#2a0808] text-white placeholder:text-gray-500'
                      : 'bg-gray-50 text-gray-800 placeholder:text-gray-400'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto custom-scrollbar py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-gray-400 font-bold uppercase text-center">
                No matches
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(value) === String(opt.value);
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`px-3 py-2 cursor-pointer transition-colors text-[10px] sm:text-xs font-bold uppercase tracking-wide flex items-center justify-between gap-2 ${getOptionClass(
                      isSelected,
                      opt.isDestructive,
                      isHighlighted
                    )}`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
