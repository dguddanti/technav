import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface ComboboxProps {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  describedBy?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}

export const Combobox = ({ id, label, value, options, placeholder, describedBy, invalid, onChange }: ComboboxProps) => {
  const listId = useId();
  const field = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const activeOption = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(-1);
  const matches = options.filter((option) => option.toLowerCase().includes(filter.trim().toLowerCase()));
  const expanded = open && !!filter.trim();

  useEffect(() => {
    if (open) activeOption.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !field.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  const showOptions = () => {
    if (!value.trim()) return;
    setFilter(value);
    setActive(-1);
    setOpen(true);
  };

  const select = (option: string) => {
    input.current?.focus();
    onChange(option);
    setOpen(false);
    setFilter('');
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!filter.trim()) return;
      if (!open) setOpen(true);
      setActive((current) => event.key === 'ArrowDown'
        ? Math.min(current + 1, matches.length - 1)
        : Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && open && active >= 0 && matches[active]) {
      event.preventDefault();
      select(matches[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={field} className="ui-field" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label className="ui-label" htmlFor={id}>{label}</label>
      <div className={`ui-combobox ${expanded ? 'is-open' : ''}`}>
        <input
          ref={input}
          id={id}
          role="combobox"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && active >= 0 && matches[active] ? `${listId}-${active}` : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onFocus={() => { if (filter && value.trim()) showOptions(); }}
          onClick={() => { if (filter && !open) showOptions(); }}
          onChange={(event) => {
            onChange(event.target.value);
            setFilter(event.target.value);
            setActive(-1);
            setOpen(!!event.target.value.trim());
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {expanded && (
        <div className="ui-combobox-popup">
          <ul id={listId} role="listbox" aria-label={`${label} locations`} className="ui-options">
            {matches.map((option, index) => (
              <li
                key={option}
                ref={index === active ? activeOption : undefined}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.toLowerCase() === value.trim().toLowerCase()}
                className={`ui-option ${index === active ? 'is-active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
              >
                <span>{option}</span>
              </li>
            ))}
          </ul>
          <p className={`ui-options-summary ${matches.length ? 'has-results' : ''}`} role="status">
            {matches.length ? `${matches.length} locations available` : 'No locations found. Try another room.'}
          </p>
        </div>
      )}
    </div>
  );
};
