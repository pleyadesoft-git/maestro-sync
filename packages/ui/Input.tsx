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

function getFriendlyValidationMessage(
  validity: ValidityState,
  input: HTMLInputElement,
  label?: string
): string {
  const fieldName = label?.trim() || 'Este campo'

  if (validity.valueMissing) {
    if (input.type === 'email') return 'El correo electrónico es requerido.'
    if (input.type === 'password') return 'La contraseña es requerida.'
    return `${fieldName} es requerido.`
  }
  if (validity.typeMismatch) {
    if (input.type === 'email') return 'Ingresa un correo electrónico válido (ej. usuario@orquesta.com).'
    if (input.type === 'url') return 'Ingresa una URL válida.'
    return 'El formato ingresado no es válido.'
  }
  if (validity.tooShort) {
    return `${fieldName} debe tener al menos ${input.minLength} caracteres.`
  }
  if (validity.tooLong) {
    return `${fieldName} no puede exceder los ${input.maxLength} caracteres.`
  }
  if (validity.rangeUnderflow) {
    return `El valor mínimo permitido es ${input.min}.`
  }
  if (validity.rangeOverflow) {
    return `El valor máximo permitido es ${input.max}.`
  }
  if (validity.patternMismatch) {
    return 'El formato no coincide con el patrón requerido.'
  }
  if (validity.stepMismatch) {
    return 'El valor no coincide con el incremento permitido.'
  }
  if (validity.badInput) {
    return 'Por favor ingresa un valor válido.'
  }
  return input.validationMessage || 'Valor no válido.'
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
      onChange,
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

    // Sync form submission and reset to show/clear CSS validation errors
    React.useEffect(() => {
      const input = inputRef.current
      if (!input || !input.form) return
      const form = input.form

      const handleFormSubmit = () => {
        setTouched(true)
        if (!input.validity.valid) {
          setInternalError(getFriendlyValidationMessage(input.validity, input, label))
        }
      }

      const handleFormReset = () => {
        setTouched(false)
        setInternalError(null)
      }

      form.addEventListener('submit', handleFormSubmit, { capture: true })
      form.addEventListener('reset', handleFormReset)

      return () => {
        form.removeEventListener('submit', handleFormSubmit, { capture: true })
        form.removeEventListener('reset', handleFormReset)
      }
    }, [label])

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true)
      if (!e.target.validity.valid) {
        setInternalError(getFriendlyValidationMessage(e.target.validity, e.target, label))
      } else {
        setInternalError(null)
      }
      onBlur?.(e)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.currentTarget
      if (touched || internalError) {
        if (!target.validity.valid) {
          setInternalError(getFriendlyValidationMessage(target.validity, target, label))
        } else {
          setInternalError(null)
        }
      }
      onChange?.(e)
    }

    const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
      const target = e.currentTarget
      if (touched || internalError) {
        if (!target.validity.valid) {
          setInternalError(getFriendlyValidationMessage(target.validity, target, label))
        } else {
          setInternalError(null)
        }
      }
      if (onInput) {
        ;(onInput as any)(e)
      }
    }

    // Completely prevent native browser validation popup bubbles
    const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
      e.preventDefault()
      setTouched(true)
      setInternalError(getFriendlyValidationMessage(e.currentTarget.validity, e.currentTarget, label))
      if (onInvalid) {
        ;(onInvalid as any)(e)
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
            onChange={handleChange}
            onInput={handleInput}
            onInvalid={handleInvalid}
            className={cn(
              // Base Stand-Ready style (Tailwind + ShadCN)
              'w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 text-sm transition-all duration-150',
              // Focus state (amber accent)
              'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50',
              // Padding adjustments for icons
              leftIcon ? 'pl-10' : 'pl-4',
              rightIcon || isInvalid ? 'pr-10' : 'pr-4',
              // Modern CSS :user-invalid state
              '[&:user-invalid]:border-rose-500 [&:user-invalid]:bg-rose-950/15 [&:user-invalid]:focus:border-rose-500 [&:user-invalid]:focus:ring-rose-500/30',
              // Explicit invalid state for controlled and internal error messages
              isInvalid && 'border-rose-500 bg-rose-950/15 focus:border-rose-500 focus:ring-rose-500/30 text-rose-100',
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

        {/* Modern Validation Error Message (Tailwind + ShadCN CSS Styled) */}
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
