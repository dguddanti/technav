import type { ComponentProps } from 'react';

interface MessageProps extends ComponentProps<'p'> {
  tone?: 'muted' | 'error';
}

export const Message = ({ tone = 'muted', className = '', ...props }: MessageProps) => (
  <p className={`ui-message ui-message--${tone} ${className}`} {...props} />
);
