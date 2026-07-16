import { useEffect, useRef, useState } from 'react';
import { searchBggGames } from '../../utils/bggSearch';
import { useTranslation } from '../../i18n/useTranslation';

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

// Game title input with live autocomplete from BoardGameGeek. Free text
// always keeps working: suggestions are optional, and any BGG failure
// fails silent (no dropdown, no error).
function GameSearchInput({ value, onChange, onSelect, disabled }) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState(value.trim());
  const skipNextSearchRef = useRef(false);

  // Render-phase state adjustment (no sync setState in effects): reset
  // the dropdown as soon as the query drops below the minimum length
  const query = value.trim();
  if (query !== lastQuery) {
    setLastQuery(query);
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setSearching(false);
    }
  }

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchBggGames(query, controller.signal);
        setSuggestions(results);
        setActiveIndex(-1);
        setOpen(results.length > 0);
        setSearching(false);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
          setOpen(false);
          setSearching(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const select = (game) => {
    skipNextSearchRef.current = true;
    close();
    onSelect(game);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      // Only intercept Enter when a suggestion is highlighted; a plain
      // Enter still submits the form with free text
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        select(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={close}
        maxLength={80}
        placeholder={t('suggestGamePlaceholder')}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={disabled}
      />
      {searching && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          ...
        </span>
      )}
      {open && (
        <ul
          role="listbox"
          className="absolute z-20 left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg py-1"
        >
          {suggestions.map((game, index) => (
            <li key={game.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                // mousedown fires before the input's blur closes the list
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(game);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full text-left px-3 py-1.5 text-sm ${
                  index === activeIndex ? 'bg-blue-50' : ''
                }`}
              >
                <span className="text-gray-900">{game.name}</span>
                {game.year && (
                  <span className="ml-1.5 text-xs text-gray-400">
                    ({game.year})
                  </span>
                )}
              </button>
            </li>
          ))}
          <li className="px-3 pt-1 mt-1 border-t border-gray-100 text-[10px] text-gray-400">
            {t('bggFooterHint')}
          </li>
        </ul>
      )}
    </div>
  );
}

export default GameSearchInput;
