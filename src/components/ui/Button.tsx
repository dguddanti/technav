import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
}

export const Button = ({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) => (
  <button type={type} className={`ui-button ui-button--${variant} ${className}`} {...props} />
);
