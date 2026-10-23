import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Select } from './Select';
const options = [{ value: '1', label: 'Floor 1' }, { value: '2', label: 'Floor 2' }, { value: '3', label: 'Floor 3' }];
describe('shared select', () => {
  it('supports keyboard selection, restores focus, and closes without changing the value on Escape', () => {
    const change = vi.fn(); render(<Select label="Floor" value="1" options={options} onChange={change} />);
    const trigger = screen.getByRole('combobox');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger); fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(change).toHaveBeenCalledTimes(1);
  });
  it('filters long option lists and selects a result', () => {
    const change = vi.fn(); render(<Select searchable label="Photo spot" value="" options={options} onChange={change} />);
    fireEvent.click(screen.getByRole('combobox'));
    const search = screen.getByRole('searchbox', { name: 'Search photo spot' });
    fireEvent.change(search, { target: { value: '2' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith('2');
  });
});
