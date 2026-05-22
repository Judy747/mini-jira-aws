import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as LabelPrimitive from '@radix-ui/react-label'

declare module '@/components/ui/dialog' {
  export const Dialog: typeof DialogPrimitive.Root
  export const DialogTrigger: typeof DialogPrimitive.Trigger
  export const DialogPortal: typeof DialogPrimitive.Portal
  export const DialogClose: typeof DialogPrimitive.Close
  export const DialogOverlay: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
  >
  export const DialogContent: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
      className?: string
      children?: React.ReactNode
    }
  >
  export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>>
  export const DialogTitle: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
  >
  export const DialogDescription: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
  >
}

declare module '@/components/ui/badge' {
  export const Badge: React.FC<
    React.HTMLAttributes<HTMLDivElement> & {
      variant?: 'default' | 'secondary' | 'outline' | 'destructive'
    }
  >
  export const badgeVariants: (props?: {
    variant?: 'default' | 'secondary' | 'outline' | 'destructive'
    className?: string
  }) => string
}

declare module '@/components/ui/input' {
  export const Input: React.ForwardRefExoticComponent<
    React.InputHTMLAttributes<HTMLInputElement> & { className?: string }
  >
}

declare module '@/components/ui/textarea' {
  export const Textarea: React.ForwardRefExoticComponent<
    React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }
  >
}

declare module '@/components/ui/select' {
  export const Select: typeof SelectPrimitive.Root
  export const SelectGroup: typeof SelectPrimitive.Group
  export const SelectValue: typeof SelectPrimitive.Value
  export const SelectTrigger: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
      className?: string
      children?: React.ReactNode
    }
  >
  export const SelectContent: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
      className?: string
      children?: React.ReactNode
      position?: 'item-aligned' | 'popper'
    }
  >
  export const SelectItem: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
      className?: string
      children?: React.ReactNode
    }
  >
}

declare module '@/components/ui/button' {
  export const Button: React.ForwardRefExoticComponent<
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
      size?: 'default' | 'sm' | 'lg' | 'icon'
      asChild?: boolean
      className?: string
    }
  >
  export const buttonVariants: (props?: {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    className?: string
  }) => string
}

declare module '@/components/ui/label' {
  export const Label: React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { className?: string }
  >
}

declare module '@/components/ui/skeleton' {
  export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>>
}
