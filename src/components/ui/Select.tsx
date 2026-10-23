import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import './Select.css';

interface SelectOption { value: string; label: string }
interface SelectProps {
  label: string; value: string; options: SelectOption[]; onChange: (value: string) => void;
  placeholder?: string; searchable?: boolean; disabled?: boolean;
}
export const Select = ({ label, value, options, onChange, placeholder = 'Select an option', searchable = false, disabled = false }: SelectProps) => {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const matches = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = options.find((option) => option.value === value);
  const choose = (option: SelectOption) => { onChange(option.value); setOpen(false); trigger.current?.focus(); };
  const show = () => {
    const box = root.current?.getBoundingClientRect();
    const boundary = root.current?.closest('fieldset, dialog')?.getBoundingClientRect();
    if (box) { const bottom = Math.min(window.innerHeight, boundary?.bottom ?? window.innerHeight); setAbove(bottom - box.bottom < (searchable ? 284 : 224) && box.top > bottom - box.bottom); }
    setQuery(''); setActive(Math.max(0, options.findIndex((option) => option.value === value))); setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    if (searchable) search.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); };
  }, [open, searchable]);
  useEffect(() => {
    const option = activeOption.current;
    const list = root.current?.querySelector('.ui-select-options');
    if (!open || !option || !list) return;
    const itemBox = option.getBoundingClientRect(), listBox = list.getBoundingClientRect();
    if (itemBox.top < listBox.top) list.scrollTop += itemBox.top - listBox.top;
    else if (itemBox.bottom > listBox.bottom) list.scrollTop += itemBox.bottom - listBox.bottom;
  }, [active, open]);
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    else if (event.key === 'Tab') setOpen(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); if (!open) show(); else setActive((index) => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (open && event.key === 'Enter') { event.preventDefault(); if (matches[active]) choose(matches[active]); }
    else if (open && !searchable && (event.key === 'Home' || event.key === 'End')) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : matches.length - 1); }
    else if (open && !searchable && event.key.length === 1 && event.key !== ' ') { const index = matches.findIndex((option) => option.label.toLowerCase().startsWith(event.key.toLowerCase())); if (index >= 0) setActive(index); }
  };
  return <div ref={root} className="ui-select" data-open={open} onKeyDown={key} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span id={`${id}-label`} className="ui-select-label">{label}</span>
    <button ref={trigger} type="button" className="ui-select-trigger" role="combobox" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined} disabled={disabled} onClick={() => open ? setOpen(false) : show()}>
      <span id={`${id}-value`} data-placeholder={!selected}>{selected?.label ?? placeholder}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
    </button>
    {open && <div className="ui-select-popup" data-above={above}>
      {searchable && <input ref={search} type="search" className="ui-select-search" aria-label={`Search ${label.toLowerCase()}`} aria-controls={`${id}-list`} aria-activedescendant={matches[active] ? `${id}-option-${active}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder="Search locations…" />}
      <div id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="ui-select-options">{matches.map((option, index) => <button ref={index === active ? activeOption : undefined} type="button" tabIndex={-1} role="option" id={`${id}-option-${index}`} key={option.value} aria-selected={option.value === value} className={index === active ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onPointerMove={() => setActive(index)} onClick={() => choose(option)}><span>{option.label}</span>{option.value === value && <span aria-hidden="true">✓</span>}</button>)}{!matches.length && <p role="status">No matching locations</p>}</div>
    </div>}
  </div>;
};
