import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Combobox } from './Combobox';

const Example = () => {
  const [value, setValue] = useState('Main Entrance');
  return (
    <form>
      <Combobox id="location" label="Location" value={value} options={['Main Entrance', 'A112', 'A114', 'F125']} onChange={setValue} />
      <button type="submit">Continue</button>
    </form>
  );
};

afterEach(cleanup);

describe('Combobox', () => {
  it('only shows suggestions after typing, filters without case sensitivity, and selects with a pointer', () => {
    render(<Example />);
    const input = screen.getByRole('combobox', { name: 'Location' });
    fireEvent.click(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'a11' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.click(screen.getByRole('option', { name: 'A112' }));
    expect(input).toHaveValue('A112');
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens and selects with arrow keys and Enter without submitting the form', () => {
    render(<Example />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'a11' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)).toHaveTextContent('A112');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('A112');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('handles empty results and dismisses on Escape, Tab, blur, and outside pointer', () => {
    render(<Example />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByRole('status')).toHaveTextContent('No locations found');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('zzz');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    for (const key of ['Tab', 'Escape']) {
      fireEvent.click(input);
      fireEvent.keyDown(input, { key });
      expect(input).toHaveAttribute('aria-expanded', 'false');
    }
    fireEvent.click(input);
    fireEvent.blur(input, { relatedTarget: screen.getByRole('button', { name: 'Continue' }) });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(input);
    fireEvent.pointerDown(document.body);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});
