import * as React from "react"
import { cn } from "@/lib/utils"

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'accent' | 'elevated';
}

const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  ({ className, variant = 'elevated', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-gray-200 dark:border-gray-800 text-card-foreground",
          {
            'bg-indigo-600 text-white': variant === 'primary',
            'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100': variant === 'accent',
            'bg-white dark:bg-gray-900': variant === 'elevated'
          },
          className
        )}
        {...props}
      />
    )
  }
)
GradientCard.displayName = "GradientCard"

const GradientCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-0.5 p-4", className)}
    {...props}
  />
))
GradientCardHeader.displayName = "GradientCardHeader"

const GradientCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-semibold leading-tight", className)}
    {...props}
  />
))
GradientCardTitle.displayName = "GradientCardTitle"

const GradientCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
GradientCardDescription.displayName = "GradientCardDescription"

const GradientCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
))
GradientCardContent.displayName = "GradientCardContent"

const GradientCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 pt-0", className)}
    {...props}
  />
))
GradientCardFooter.displayName = "GradientCardFooter"

export { GradientCard, GradientCardHeader, GradientCardFooter, GradientCardTitle, GradientCardDescription, GradientCardContent }