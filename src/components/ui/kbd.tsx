import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const kbdVariants = cva(
  'inline-flex items-center justify-center rounded font-mono font-medium select-none transition-all',
  {
    variants: {
      variant: {
        default: 'bg-muted border border-border/70 text-muted-foreground shadow-[0_2px_0_0_var(--border)]',
        outline: 'bg-background border border-border text-foreground',
        ghost:   'bg-transparent text-muted-foreground',
        solid:   'bg-foreground border border-transparent text-background shadow-[0_2px_0_0_rgba(0,0,0,0.25)]',
      },
      size: {
        sm:      'h-5 min-w-5 px-1 text-[10px]',
        default: 'h-6 min-w-6 px-1.5 text-xs',
        lg:      'h-7 min-w-7 px-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface KbdProps
  extends React.ComponentProps<'kbd'>,
    VariantProps<typeof kbdVariants> {}

function Kbd({ className, variant, size, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Kbd, kbdVariants }
