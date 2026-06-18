import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const VARIANTS = {
  primary:
    'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-lg shadow-brand-600/30',
  secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/15',
  ghost: 'bg-transparent hover:bg-white/10 text-white/80',
} as const;

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-8 py-3.5 text-lg',
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={`rounded-2xl font-bold transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
