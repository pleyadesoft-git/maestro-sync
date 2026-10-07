import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from './utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  errorMessage?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  containerClassName?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      containerClassName,
      id,
      required,
      type = 'text',
      onBlur,
      onInput,
      onInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`
    const [touched, setTouched] = React.useState(false)
    const [internalError, setInternalError] = React.useState<string | null>(null)
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true)
      if (!e.target.validity.valid) {
        setInternalError(e.target.validationMessage)
      } else {
        setInternalError(null)
      }
      onBlur?.(e)
    }

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      const target = e.currentTarget
      if (touched || internalError) {
        if (!target.validity.valid) {
          setInternalError(target.validationMessage)
        } else {
          setInternalError(null)
        }
      }
      if (onInput) {
        ;(onInput as React.FormEventHandler<HTMLInputElement>)(e)
      }
    }

    // Prevent native browser validation popup bubbles
    const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
      e.preventDefault()
      setTouched(true)
      setInternalError(e.currentTarget.validationMessage)
      if (onInvalid) {
        ;(onInvalid as React.FormEventHandler<HTMLInputElement>)(e)
      }
    }

    const displayError = errorMessage || internalError
    const isInvalid = Boolean(displayError)

    return (
      <div className={cn('w-full group/field space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-xs font-semibold text-slate-400 uppercase tracking-wider transition-colors',
              isInvalid && 'text-rose-400'
            )}
          >
            {label}
            {required && <span className="text-amber-500 ml-1 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within/field:text-amber-400 transition-colors">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={inputRef}
            type={type}
            required={required}
            aria-invalid={isInvalid ? 'true' : undefined}
            aria-describedby={isInvalid ? errorId : helperText ? helperId : undefined}
            onBlur={handleBlur}
            onInput={handleInput}
            onInvalid={handleInvalid}
            className={cn(
              // Base Stand-Ready style
              'w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm transition-all duration-150',
              // Focus state (amber accent)
              'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50',
              // Padding adjustments for icons
              leftIcon ? 'pl-10' : 'pl-4',
              rightIcon || isInvalid ? 'pr-10' : 'pr-4',
              // Modern CSS :user-invalid state
              '[&:user-invalid]:border-rose-500 [&:user-invalid]:bg-rose-950/15 [&:user-invalid]:focus:border-rose-500 [&:user-invalid]:focus:ring-rose-500/30',
              // Explicit invalid state for controlled error messages
              isInvalid && 'border-rose-500 bg-rose-950/15 focus:border-rose-500 focus:ring-rose-500/30',
              className
            )}
            {...props}
          />

          {/* Validation Status Indicator / Custom Right Icon */}
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            {isInvalid ? (
              <AlertCircle className="w-4 h-4 text-rose-500 transition-transform duration-200" />
            ) : rightIcon ? (
              rightIcon
            ) : null}
          </div>
        </div>

        {/* Modern Validation Error Message (CSS Styled) */}
        {isInvalid ? (
          <p
            id={errorId}
            role="alert"
            className="flex items-center gap-1.5 text-xs font-medium text-rose-400 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>{displayError}</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'
