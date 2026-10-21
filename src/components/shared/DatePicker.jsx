import { useEffect, useId, useRef, useState } from 'react';
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, isValid, parse, startOfMonth, startOfWeek
} from 'date-fns';
import { useTranslation } from '../../i18n/useTranslation';

// Replaces the browser's native date/datetime-local popup, which cannot
// be styled and ignores the app language. Values keep the native string
// formats ('yyyy-MM-dd' and "yyyy-MM-dd'T'HH:mm") so callers are unchanged.
const DATE_FMT = 'yyyy-MM-dd';
const DATETIME_FMT = "yyyy-MM-dd'T'HH:mm";
const DEFAULT_TIME = { h: 18, m: 0 };
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (n) => String(n).padStart(2, '0');

function parseValue(value, withTime) {
  if (!value) return null;
  const d = parse(value, withTime ? DATETIME_FMT : DATE_FMT, new Date());
  return isValid(d) ? d : null;
}

const toDay = (value) => parseValue(value, false);

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-neutral-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

function Chevron({ dir }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

/**
 * MeppleTime date (or date + time) picker.
 * @param {'date'|'datetime'} mode
 * @param {string} min optional earliest selectable day, 'yyyy-MM-dd'
 * @param {string[]} exclude 'yyyy-MM-dd' days that cannot be picked
 * @param {string} rangeFrom/rangeTo optional days to tint as a range
 */
function DatePicker({
  id, value, onChange, mode = 'date', min, exclude = [], rangeFrom, rangeTo,
  disabled = false, clearable = false, className = '', wrapperClassName = ''
}) {
  const { t, dateLocale } = useTranslation();
  const withTime = mode === 'datetime';
  const selected = parseValue(value, withTime);
  const minDay = toDay(min);
  const weekStartsOn = dateLocale.options?.weekStartsOn ?? 0;
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(selected || minDay || new Date()));
  const [focusDay, setFocusDay] = useState(() => selected || minDay || new Date());
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const gridRef = useRef(null);
  const focusOnRender = useRef(false);

  const openPanel = () => {
    const start = selected || minDay || new Date();
    setMonth(startOfMonth(start));
    setFocusDay(start);
    focusOnRender.current = true;
    setOpen(true);
  };
  const closePanel = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // Close on outside click or focus leaving the picker
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Move keyboard focus to the active day after opening or arrow keys
  useEffect(() => {
    if (!open || !focusOnRender.current) return;
    focusOnRender.current = false;
    gridRef.current?.querySelector('[data-focus="true"]')?.focus();
  });

  const isDisabledDay = (day) => (!!minDay && day < minDay) || exclude.includes(format(day, DATE_FMT));
  const time = selected ? { h: selected.getHours(), m: selected.getMinutes() } : DEFAULT_TIME;

  const emit = (day, nextTime = time) => {
    if (!withTime) { onChange(format(day, DATE_FMT)); return; }
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), nextTime.h, nextTime.m);
    onChange(format(d, DATETIME_FMT));
  };

  const pick = (day) => {
    if (isDisabledDay(day)) return;
    emit(day);
    setFocusDay(day);
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
    if (!withTime) closePanel();
  };

  const moveFocus = (day) => {
    setFocusDay(day);
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
    focusOnRender.current = true;
  };

  const onGridKey = (e) => {
    const moves = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7
    };
    if (e.key in moves) { e.preventDefault(); moveFocus(addDays(focusDay, moves[e.key])); }
    else if (e.key === 'PageUp') { e.preventDefault(); moveFocus(addMonths(focusDay, -1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); moveFocus(addMonths(focusDay, 1)); }
    else if (e.key === 'Home') { e.preventDefault(); moveFocus(startOfWeek(focusDay, { weekStartsOn })); }
    else if (e.key === 'End') { e.preventDefault(); moveFocus(endOfWeek(focusDay, { weekStartsOn })); }
  };

  const onPanelKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closePanel(); }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn })
  });
  const weekDays = t('weekDays').split(',');
  const today = new Date();
  const from = toDay(rangeFrom);
  const to = toDay(rangeTo);
  // Tint the poll range; with only one end chosen, mark that day
  const inRange = (day) => (from && to ? day >= from && day <= to : (from && isSameDay(day, from)) || (to && isSameDay(day, to)));

  const label = selected
    ? format(selected, withTime ? t('pickerDateTimeFormat') : t('pickerDateFormat'), { locale: dateLocale })
    : t(withTime ? 'pickDateTimePlaceholder' : 'pickDatePlaceholder');

  const prevDisabled = !!minDay && month <= startOfMonth(minDay);

  const setTime = (part, n) => {
    const next = { ...time, [part]: n };
    emit(selected || (isDisabledDay(today) ? minDay : today), next);
  };

  const timeSelect = 'px-3 py-1.5 border border-neutral-400 rounded-full text-sm bg-ground text-ink focus:ring-2 focus:ring-terra focus:border-transparent';
  const minuteOptions = MINUTES.includes(time.m) ? MINUTES : [...MINUTES, time.m].sort((a, b) => a - b);

  return (
    <div ref={wrapperRef} className={`relative ${wrapperClassName}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        className={`w-full flex items-center justify-between gap-3 text-left disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-neutral-500'}`}>{label}</span>
        <CalendarIcon />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          data-month={format(month, 'yyyy-MM')}
          aria-label={t(withTime ? 'pickDateTimePlaceholder' : 'pickDatePlaceholder')}
          onKeyDown={onPanelKey}
          className="absolute left-0 top-full mt-2 z-40 w-[20rem] max-w-[calc(100vw-2rem)] bg-surface border border-neutral-300 rounded-lg shadow-lg p-4"
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={prevDisabled}
              aria-label={t('prevMonth')}
              className="w-11 h-11 flex items-center justify-center rounded-full text-neutral-800 hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Chevron dir="prev" />
            </button>
            <h4 aria-live="polite" className="font-bold text-ink text-base">
              {format(month, t('monthHeaderFormat'), { locale: dateLocale })}
            </h4>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label={t('nextMonth')}
              className="w-11 h-11 flex items-center justify-center rounded-full text-neutral-800 hover:bg-ink/5 transition-colors"
            >
              <Chevron dir="next" />
            </button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 mb-1" aria-hidden="true">
            {weekDays.map((day, i) => (
              <div key={i} className="text-center text-xs font-semibold text-neutral-600 py-1">{day}</div>
            ))}
          </div>

          {/* Days */}
          <div ref={gridRef} onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const isSelected = selected && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              const outside = !isSameMonth(day, month);
              const off = isDisabledDay(day);
              let look = 'text-ink hover:bg-terra-100';
              if (outside) look = 'text-neutral-500 hover:bg-terra-100';
              if (inRange(day)) look = 'bg-terra-100 text-terra-900 hover:bg-terra-200';
              if (off) look = 'text-neutral-400 cursor-not-allowed';
              if (isSelected) look = 'bg-terra text-ground font-bold hover:bg-terra-600';
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  data-date={format(day, DATE_FMT)}
                  tabIndex={isSameDay(day, focusDay) ? 0 : -1}
                  data-focus={isSameDay(day, focusDay) ? 'true' : undefined}
                  aria-pressed={!!isSelected}
                  aria-disabled={off || undefined}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={format(day, t('finalizedDateFormat'), { locale: dateLocale })}
                  onClick={() => pick(day)}
                  className={`h-11 rounded-sm text-sm font-medium transition-colors ${look} ${isToday && !isSelected ? 'border-2 border-terra-400' : 'border-2 border-transparent'}`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Time */}
          {withTime && (
            <div className="mt-4 pt-3 border-t border-neutral-300 flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-800 mr-auto">{t('timeLabel')}</span>
              <select aria-label={t('hourLabel')} value={time.h} onChange={(e) => setTime('h', Number(e.target.value))} className={timeSelect}>
                {HOURS.map(h => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <span aria-hidden="true" className="font-semibold text-neutral-700">:</span>
              <select aria-label={t('minuteLabel')} value={time.m} onChange={(e) => setTime('m', Number(e.target.value))} className={timeSelect}>
                {minuteOptions.map(m => <option key={m} value={m}>{pad(m)}</option>)}
              </select>
            </div>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center gap-2">
            {!isDisabledDay(today) && (
              <button
                type="button"
                onClick={() => pick(today)}
                className="px-3 py-2 text-sm font-medium text-sage-700 rounded-full hover:bg-ink/5 transition-colors"
              >
                {t('todayButton')}
              </button>
            )}
            {clearable && value && (
              <button
                type="button"
                onClick={() => { onChange(''); closePanel(); }}
                className="px-3 py-2 text-sm font-medium text-neutral-700 rounded-full hover:bg-ink/5 transition-colors"
              >
                {t('clearButton')}
              </button>
            )}
            {withTime && (
              <button
                type="button"
                onClick={() => closePanel()}
                className="ml-auto px-4 py-2 bg-sage-600 text-ground text-sm font-medium rounded-full hover:bg-sage-700 transition-colors"
              >
                {t('doneButton')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
