'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, MoreVertical, Trash2, RotateCcw, XCircle, CheckCircle2, Copy, RefreshCw } from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { QuoteLines } from './QuoteLines'
import { QuoteDiscounts } from './QuoteDiscounts'
import { QuotePaymentPlan } from './QuotePaymentPlan'
import { QuoteRecap } from './QuoteRecap'
import { deleteQuote, revertQuoteToDraft, setQuoteStatus, duplicateQuote, refreshQuoteClientSnapshot } from '@/lib/actions/quotes'
import { PdfButton } from './PdfButton'
import { ApproveDialog } from './ApproveDialog'
import type { Quote, QuoteStatus } from '@/lib/domain/quotes'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<QuoteStatus, { label: string; className: string }> = {
  bozza: {
    label: 'Bozza',
    className:
      'bg-[var(--color-bg)] text-[var(--color-fg-muted)] border border-[var(--color-border)]',
  },
  'in-approvazione': {
    label: 'In approvazione',
    className:
      'bg-[oklch(0.96_0.06_85)] text-[oklch(0.45_0.15_85)] border border-[oklch(0.88_0.10_85)]',
  },
  approvato: {
    label: 'Approvato',
    className:
      'bg-[oklch(0.95_0.06_150)] text-[oklch(0.40_0.14_150)] border border-[oklch(0.86_0.10_150)]',
  },
  rifiutato: {
    label: 'Rifiutato',
    className:
      'bg-[oklch(0.96_0.06_25)] text-[oklch(0.45_0.16_25)] border border-[oklch(0.88_0.10_25)]',
  },
}

// ─── Lock notices ────────────────────────────────────────────────────────────

const STATUS_NOTICE: Partial<Record<QuoteStatus, { bg: string; border: string; text: string; label: string }>> = {
  'in-approvazione': {
    bg: 'bg-[oklch(0.96_0.06_85)]',
    border: 'border-[oklch(0.88_0.10_85)]',
    text: 'text-[oklch(0.45_0.15_85)]',
    label: 'In attesa di approvazione — le righe non possono essere modificate.',
  },
  approvato: {
    bg: 'bg-[oklch(0.95_0.06_150)]',
    border: 'border-[oklch(0.86_0.10_150)]',
    text: 'text-[oklch(0.40_0.14_150)]',
    label: 'Preventivo approvato — documento sigillato.',
  },
  rifiutato: {
    bg: 'bg-[oklch(0.96_0.06_25)]',
    border: 'border-[oklch(0.88_0.10_25)]',
    text: 'text-[oklch(0.45_0.16_25)]',
    label: 'Preventivo rifiutato — nessuna modifica consentita.',
  },
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-[var(--color-surface)] rounded-[var(--radius)] p-5 border border-[var(--color-border)] space-y-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {children}
    </div>
  )
}

// ─── Client info ──────────────────────────────────────────────────────────────

function ClientInfo({
  snapshot,
  quoteId,
  isLocked,
}: {
  snapshot: Quote['clientSnapshot']
  quoteId: string
  isLocked: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      try {
        await refreshQuoteClientSnapshot(quoteId)
        toast.success('Dati cliente aggiornati')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Aggiornamento fallito')
      }
    })
  }

  const fields: { label: string; value?: string }[] = [
    { label: 'Ragione sociale', value: snapshot.name },
    { label: 'Email', value: snapshot.email },
    { label: 'Telefono', value: snapshot.phone },
    { label: 'Indirizzo', value: snapshot.address },
    { label: 'P.IVA', value: snapshot.vatNumber },
    { label: 'Cod. fiscale', value: snapshot.taxCode },
    { label: 'PEC', value: snapshot.pec },
    { label: 'SDI', value: snapshot.sdi },
  ]

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide">
          Dati cliente
        </h2>
        {!isLocked && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            title="Aggiorna dati dal profilo cliente"
            className="flex items-center gap-1 text-xs text-[var(--color-fg-faint)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
            Aggiorna
          </button>
        )}
      </div>
      <dl className="space-y-2">
        {fields.map(({ label, value }) =>
          value ? (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-[var(--color-fg-faint)]">{label}</dt>
              <dd className="text-sm text-[var(--color-fg)]">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
    </SectionCard>
  )
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function QuoteEditor({ initialQuote }: { initialQuote: Quote }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const isLocked = initialQuote.status !== 'bozza'
  const badge = STATUS_BADGE[initialQuote.status]
  const notice = STATUS_NOTICE[initialQuote.status] ?? null
  const isInApprovazione = initialQuote.status === 'in-approvazione'

  function handleDelete() {
    if (
      !confirm(
        'Eliminare il preventivo? Questa operazione non può essere annullata.',
      )
    )
      return
    startTransition(async () => {
      try {
        await deleteQuote(initialQuote.id)
        router.push('/admin/quotes')
        toast.success('Preventivo eliminato.')
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Errore durante l'eliminazione.",
        )
      }
    })
  }

  function handleRevert() {
    if (!confirm('Riportare il preventivo in bozza? Le modifiche potranno riprendere.'))
      return
    startTransition(async () => {
      try {
        await revertQuoteToDraft(initialQuote.id)
        router.refresh()
        toast.success('Preventivo riportato in bozza.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore durante il ripristino.')
      }
    })
  }

  function handleDuplicate() {
    startTransition(async () => {
      try {
        const { id } = await duplicateQuote(initialQuote.id)
        router.push(`/admin/quotes/${id}`)
        toast.success('Preventivo duplicato come nuova bozza.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore durante la duplicazione.')
      }
    })
  }

  function handleReject() {
    if (!confirm("Rifiutare il preventivo? L\u2019operazione non pu\u00f2 essere annullata."))
      return
    startTransition(async () => {
      try {
        await setQuoteStatus(initialQuote.id, 'rifiutato')
        router.push('/admin/quotes')
        toast.success('Preventivo rifiutato.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Errore durante il rifiuto.')
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/quotes"
            className="shrink-0 p-1.5 -ml-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface)] text-[var(--color-fg-muted)] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <span className="font-mono text-base font-semibold text-[var(--color-fg)] truncate">
            {initialQuote.number}
          </span>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {/* PDF button — always visible */}
        <PdfButton quoteId={initialQuote.id} />

        {/* Duplica — visible on locked statuses */}
        {isLocked && (
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isPending}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm
              border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)]
              hover:bg-[var(--color-bg)] disabled:opacity-50 transition-colors"
          >
            <Copy size={14} />
            Duplica
          </button>
        )}

        {/* Kebab — visible only on bozza */}
        {!isLocked && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface)] text-[var(--color-fg-muted)] transition-colors"
              aria-label="Azioni preventivo"
            >
              <MoreVertical size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDuplicate}
                disabled={isPending}
              >
                <Copy size={14} className="mr-2" />
                Duplica preventivo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isPending}
                className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
              >
                <Trash2 size={14} className="mr-2" />
                Elimina preventivo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Lock notice + action bar */}
      {isLocked && notice && (
        <div
          className={`rounded-[var(--radius-sm)] border px-4 py-2.5 text-sm ${notice.bg} ${notice.border} ${notice.text}`}
        >
          {notice.label}
        </div>
      )}

      {/* In-approvazione action bar */}
      {isInApprovazione && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Riporta in bozza */}
          <button
            onClick={handleRevert}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm
              border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)]
              hover:bg-[var(--color-bg)] disabled:opacity-50 transition-colors"
          >
            <RotateCcw size={14} />
            Riporta in bozza
          </button>

          <div className="flex-1" />

          {/* Rifiuta */}
          <button
            onClick={handleReject}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm
              border border-[oklch(0.88_0.10_25)] bg-[oklch(0.96_0.06_25)] text-[oklch(0.45_0.16_25)]
              hover:bg-[oklch(0.92_0.08_25)] disabled:opacity-50 transition-colors"
          >
            <XCircle size={14} />
            Rifiuta
          </button>

          {/* Approva — dialog wired in S14 */}
          <button
            onClick={() => setShowApproveDialog(true)}
            disabled={isPending || !showApproveDialog && false /* placeholder */}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium
              bg-[var(--color-accent)] text-[var(--color-accent-fg)]
              hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <CheckCircle2 size={14} />
            Approva…
          </button>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="lines">
        <TabsList className="w-full justify-start overflow-x-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius)] p-1 h-auto gap-0.5">
          <TabsTrigger
            value="client"
            className="text-sm data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-[var(--color-accent-fg)] data-[state=active]:shadow-none"
          >
            Cliente
          </TabsTrigger>
          <TabsTrigger
            value="lines"
            className="text-sm data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-[var(--color-accent-fg)] data-[state=active]:shadow-none"
          >
            Righe
          </TabsTrigger>
          <TabsTrigger
            value="discounts"
            className="text-sm data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-[var(--color-accent-fg)] data-[state=active]:shadow-none"
          >
            IVA & Sconti
          </TabsTrigger>
          <TabsTrigger
            value="payment"
            className="text-sm data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-[var(--color-accent-fg)] data-[state=active]:shadow-none"
          >
            Pagamento
          </TabsTrigger>
          <TabsTrigger
            value="recap"
            className="text-sm data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-[var(--color-accent-fg)] data-[state=active]:shadow-none"
          >
            Recap
          </TabsTrigger>
        </TabsList>

        {/* Cliente */}
        <TabsContent value="client" className="mt-4">
          <ClientInfo snapshot={initialQuote.clientSnapshot} quoteId={initialQuote.id} isLocked={isLocked} />
        </TabsContent>

        {/* Righe */}
        <TabsContent value="lines" className="mt-4">
          <SectionCard>
            <h2 className="text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide">
              Righe preventivo
            </h2>
            <QuoteLines
              quoteId={initialQuote.id}
              initialLines={initialQuote.lines}
              readonly={isLocked}
            />
          </SectionCard>
        </TabsContent>

        {/* IVA & Sconti — S7 */}
        <TabsContent value="discounts" className="mt-4">
          <SectionCard>
            <h2 className="text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide">
              IVA & Sconti
            </h2>
            <QuoteDiscounts
              quoteId={initialQuote.id}
              initialDiscounts={initialQuote.discounts}
              initialVatPercent={initialQuote.vatPercent}
              subtotalCents={initialQuote.totals.subtotalCents}
              readonly={isLocked}
            />
          </SectionCard>
        </TabsContent>

        {/* Pagamento — S8 */}
        <TabsContent value="payment" className="mt-4">
          <SectionCard>
            <h2 className="text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide">
              Piano di pagamento
            </h2>
            <QuotePaymentPlan
              quoteId={initialQuote.id}
              initialPayment={initialQuote.payment}
              totalCents={initialQuote.totals.totalCents}
              readonly={isLocked}
            />
          </SectionCard>
        </TabsContent>

        {/* Recap — S9 */}
        <TabsContent value="recap" className="mt-4">
          <SectionCard>
            <h2 className="text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide">
              Riepilogo
            </h2>
            <QuoteRecap initialQuote={initialQuote} />
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Approve dialog — opened by the Approva… button */}
      <ApproveDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        quote={initialQuote}
      />
    </div>
  )
}
