'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button, Card } from '@music-flow/ui'
import { createBrowserClient } from '@music-flow/supabase'
import {
  CreditCard,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

interface SubscriptionData {
  id: string
  status: string
  isActive: boolean
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  seatQuantity: number
  planCode: string
  planName: string
  priceCents: number
  billingInterval: string
  ensembleType: string | null
}

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  locale: string
  onSubscriptionChange?: () => void
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  locale,
  onSubscriptionChange,
}: SubscriptionModalProps) {
  const t = useTranslations('subscription')
  const tPricing = useTranslations('pricing')
  const router = useRouter()
  const supabase = createBrowserClient()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [loading, setLoading] = useState(true)
  const [subData, setSubData] = useState<SubscriptionData | null>(null)
  const [isTrialActive, setIsTrialActive] = useState(false)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
  const [isCourtesy, setIsCourtesy] = useState(false)

  // Sub-vista de cancelación
  const [view, setView] = useState<'info' | 'cancel_confirm'>('info')
  const [cancelImmediate, setCancelImmediate] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Cargar información de suscripción
  const fetchStatus = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) return

      const res = await fetch('/api/subscription/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        setSubData(json.subscription)
        setIsTrialActive(Boolean(json.isTrialActive))
        setTrialDaysLeft(json.trialDaysLeft)
        setTrialEndsAt(json.trialEndsAt)
        setIsCourtesy(Boolean(json.isCourtesy))
      }
    } catch (e: any) {
      console.error('Error fetching subscription status:', e)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const handleClose = useCallback(() => {
    dialogRef.current?.close()
    setView('info')
    setActionError(null)
    setActionSuccess(null)
    onClose()
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    if (isOpen) {
      if (dialog && !dialog.open) {
        dialog.showModal()
      }
      let cancelled = false
      void (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData.session?.access_token
          if (!token || cancelled) return

          const res = await fetch('/api/subscription/status', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          const json = await res.json()
          if (!cancelled && res.ok && json.ok) {
            setSubData(json.subscription)
            setIsTrialActive(Boolean(json.isTrialActive))
            setTrialDaysLeft(json.trialDaysLeft)
            setTrialEndsAt(json.trialEndsAt)
            setIsCourtesy(Boolean(json.isCourtesy))
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('Error fetching subscription status:', e)
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    } else {
      if (dialog && dialog.open) {
        dialog.close()
      }
    }
  }, [isOpen, supabase])

  // Light dismiss fallback
  const handlePointerDown = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current
    if (!dialog) return
    const rect = dialog.getBoundingClientRect()
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    if (clickedOutside) {
      handleClose()
    }
  }

  // Cancelar suscripción
  const handleConfirmCancel = async () => {
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No autorizado.')

      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          immediate: cancelImmediate,
          reason: cancelReason || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || t('errorGeneric'))
      }

      const formattedDate = json.currentPeriodEnd
        ? new Date(json.currentPeriodEnd).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })
        : ''

      setActionSuccess(
        cancelImmediate
          ? t('cancelImmediateSuccess')
          : t('cancelScheduledSuccess', { date: formattedDate })
      )
      await fetchStatus()
      setView('info')
      onSubscriptionChange?.()
    } catch (e: any) {
      setActionError(e?.message || t('errorGeneric'))
    } finally {
      setActionLoading(false)
    }
  }

  // Reactivar suscripción
  const handleReactivate = async () => {
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No autorizado.')

      const res = await fetch('/api/subscription/reactivate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || t('errorGeneric'))
      }

      setActionSuccess(t('reactivateSuccess'))
      await fetchStatus()
      onSubscriptionChange?.()
    } catch (e: any) {
      setActionError(e?.message || t('errorGeneric'))
    } finally {
      setActionLoading(false)
    }
  }

  // Abrir portal de facturación de Stripe
  const handleOpenBillingPortal = async () => {
    setPortalLoading(true)
    setActionError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('No autorizado.')

      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const json = await res.json()
      if (!res.ok || !json.ok || !json.url) {
        throw new Error(json.error || t('errorGeneric'))
      }

      window.location.href = json.url
    } catch (e: any) {
      setActionError(e?.message || t('errorGeneric'))
      setPortalLoading(false)
    }
  }

  const formattedPeriodEnd = subData?.currentPeriodEnd
    ? new Date(subData.currentPeriodEnd).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : ''

  const priceFormatted = subData
    ? `$${(subData.priceCents / 100).toFixed(0)} USD`
    : ''

  return (
    <dialog
      ref={dialogRef}
      onPointerDown={handlePointerDown}
      onClose={handleClose}
      aria-labelledby="subscription-dialog-title"
      className="m-auto p-0 bg-transparent text-slate-100 max-w-lg w-full rounded-2xl shadow-2xl backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      <div
        className="p-6 sm:p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6 text-slate-100"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Diálogo */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 id="subscription-dialog-title" className="text-xl font-bold text-slate-100">
                {view === 'info' ? t('manageTitle') : t('cancelModalTitle')}
              </h2>
              <p className="text-xs text-slate-400">
                {view === 'info' ? t('manageDesc') : t('cancelModalDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensajes de Feedback */}
        {actionError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div role="status" className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span>Cargando estado de suscripción…</span>
          </div>
        ) : view === 'info' ? (
          /* =====================================================================
             VISTA 1: INFORMACIÓN Y GESTIÓN DE SUSCRIPCIÓN
             ===================================================================== */
          <div className="space-y-5">
            {subData && subData.isActive ? (
              <>
                {/* Banner de Cancelación Programada si aplica */}
                {subData.cancelAtPeriodEnd && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <ShieldAlert className="w-4 h-4" />
                      <span>{t('statusScheduledCancel')}</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      {t('scheduledCancelAlert', { date: formattedPeriodEnd })}
                    </p>
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleReactivate}
                        disabled={actionLoading}
                        className="w-full text-xs font-semibold"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {actionLoading ? t('reactivating') : t('reactivate')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tarjeta del Plan Actual */}
                <Card className="p-5 bg-slate-950/60 border-slate-800 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {t('currentPlan')}
                      </span>
                      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                        <span>{subData.planName}</span>
                        {isCourtesy && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Cortesía
                          </span>
                        )}
                      </h3>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-extrabold text-slate-100">
                        {priceFormatted}
                      </span>
                      <span className="text-xs text-slate-400 block">
                        / {subData.billingInterval === 'year' ? tPricing('perYear') : tPricing('perMonth')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>
                        {subData.cancelAtPeriodEnd ? t('expirationDate') : t('renewalDate')}:{' '}
                        <strong className="text-slate-100">{formattedPeriodEnd}</strong>
                      </span>
                    </div>

                    <div>
                      {subData.status === 'active' && !subData.cancelAtPeriodEnd && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> {t('statusActive')}
                        </span>
                      )}
                      {subData.status === 'trialing' && !subData.cancelAtPeriodEnd && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Sparkles className="w-3 h-3" /> {t('statusTrialing')}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Acciones principales */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  {Boolean(subData.stripeCustomerId) && !isCourtesy && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleOpenBillingPortal}
                      disabled={portalLoading}
                      className="w-full sm:flex-1 text-xs"
                    >
                      {portalLoading ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                      )}
                      <span>{portalLoading ? t('openingPortal') : t('billingPortal')}</span>
                    </Button>
                  )}

                  {!subData.cancelAtPeriodEnd && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setActionError(null)
                        setActionSuccess(null)
                        setView('cancel_confirm')
                      }}
                      className="w-full sm:flex-1 text-xs border-rose-500/30 text-rose-300 hover:bg-rose-950/20 hover:text-rose-200 hover:border-rose-500/50"
                    >
                      <span>{t('cancelButton')}</span>
                    </Button>
                  )}
                </div>
              </>
            ) : (
              /* Usuario en prueba gratuita o sin suscripción activa */
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4 text-center">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-100">
                    {isTrialActive ? t('freeTier') : t('noActiveSubscription')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isTrialActive && trialDaysLeft != null
                      ? `Te quedan ${trialDaysLeft} días de prueba completa sin restricciones.`
                      : 'Activa un plan para sincronizar partituras en vivo y disfrutar de funciones ilimitadas.'}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    handleClose()
                    router.push(`/${locale}/pricing`)
                  }}
                  className="w-full text-xs font-semibold"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  <span>{t('viewPlans')}</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* =====================================================================
             VISTA 2: CONFIRMACIÓN DE CANCELACIÓN DE SUSCRIPCIÓN
             ===================================================================== */
          <div className="space-y-5">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecciona cómo deseas aplicar la cancelación:
              </label>

              {/* Opción 1: Al fin del período (Recomendada) */}
              <label
                className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  !cancelImmediate
                    ? 'bg-amber-500/10 border-amber-500/40 text-slate-100'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="cancel_type"
                  checked={!cancelImmediate}
                  onChange={() => setCancelImmediate(false)}
                  className="mt-0.5 accent-amber-500"
                />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-200">
                    {t('cancelOptionPeriodEnd')}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {t('cancelOptionPeriodEndDesc', { date: formattedPeriodEnd })}
                  </div>
                </div>
              </label>

              {/* Opción 2: Cancelación inmediata */}
              <label
                className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  cancelImmediate
                    ? 'bg-rose-950/20 border-rose-500/40 text-slate-100'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="cancel_type"
                  checked={cancelImmediate}
                  onChange={() => setCancelImmediate(true)}
                  className="mt-0.5 accent-rose-500"
                />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-200">
                    {t('cancelOptionImmediate')}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {t('cancelOptionImmediateDesc')}
                  </div>
                </div>
              </label>
            </div>

            {/* Motivo de cancelación opcional */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 block font-medium">
                {t('cancelReasonLabel')}
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
              >
                <option value="">{t('reasonSelect')}</option>
                <option value="price">{t('reasonPrice')}</option>
                <option value="low_usage">{t('reasonLowUsage')}</option>
                <option value="missing_features">{t('reasonMissingFeatures')}</option>
                <option value="temporary">{t('reasonTemporary')}</option>
                <option value="other">{t('reasonOther')}</option>
              </select>
            </div>

            {/* Botones de confirmación: Safe button tiene autofocus según Modern Web Guidance */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                autoFocus
                onClick={() => setView('info')}
                disabled={actionLoading}
                className="w-full sm:flex-1 text-xs"
              >
                <span>{t('keepSubscription')}</span>
              </Button>

              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmCancel}
                disabled={actionLoading}
                className="w-full sm:flex-1 text-xs font-semibold"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>{t('cancelling')}</span>
                  </>
                ) : (
                  <span>{t('confirmCancel')}</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}
