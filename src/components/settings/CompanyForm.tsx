'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, GripVertical, Upload, X } from 'lucide-react'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { clientApp } from '@/lib/firebase/client'
import { saveCompanySettings } from '@/lib/actions/company'
import { SaveCompanySettingsSchema } from '@/lib/domain/schemas/company'
import type { CompanySettings, CompanyFooterIcon, FooterIconKind } from '@/lib/domain/company'

// ─── Styles ──────────────────────────────────────────────────────────────────

const fieldCls = (err?: string) =>
  `flex h-11 w-full rounded-[var(--radius-sm)] border px-3.5 py-2 text-[15px] bg-[var(--color-surface)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 disabled:opacity-50${err ? ' border-[var(--color-danger)]' : ' border-[var(--color-border)]'}`

const labelCls = 'block text-sm text-[var(--color-fg-muted)] mb-1'

const sectionCls = 'space-y-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]'

const sectionTitleCls = 'text-sm font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  initial: CompanySettings | null
}

const ICON_KIND_LABELS: Record<FooterIconKind, string> = {
  website: 'Sito web',
  email: 'Email',
  phone: 'Telefono',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  custom: 'Personalizzato',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompanyForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Anagrafica
  const [legalName, setLegalName] = useState(initial?.legalName ?? '')
  const [vatNumber, setVatNumber] = useState(initial?.vatNumber ?? '')
  const [taxCode, setTaxCode] = useState(initial?.taxCode ?? '')

  // Indirizzo
  const [street, setStreet] = useState(initial?.address?.street ?? '')
  const [zip, setZip] = useState(initial?.address?.zip ?? '')
  const [city, setCity] = useState(initial?.address?.city ?? '')
  const [country, setCountry] = useState(initial?.address?.country ?? 'Italia')

  // Contatti
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [pec, setPec] = useState(initial?.pec ?? '')
  const [sdi, setSdi] = useState(initial?.sdi ?? '')
  const [iban, setIban] = useState(initial?.iban ?? '')

  // Logo
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? '')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoProgress, setLogoProgress] = useState(0)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Footer icons
  const [footerIcons, setFooterIcons] = useState<CompanyFooterIcon[]>(
    initial?.footerIcons ?? [],
  )

  // PDF
  const [defaultVatPercent, setDefaultVatPercent] = useState(
    String(initial?.defaultVatPercent ?? 5),
  )
  const [pdfAccentHex, setPdfAccentHex] = useState(initial?.pdfAccentHex ?? '#3b6fd4')
  const [footerNote, setFooterNote] = useState(initial?.footerNote ?? '')

  // ─── Footer icons helpers ─────────────────────────────────────────────────

  function addIcon() {
    if (footerIcons.length >= 6) return
    setFooterIcons((prev) => [...prev, { kind: 'website', label: '', value: '' }])
  }

  function updateIcon(i: number, patch: Partial<CompanyFooterIcon>) {
    setFooterIcons((prev) => prev.map((icon, idx) => (idx === i ? { ...icon, ...patch } : icon)))
  }

  function removeIcon(i: number) {
    setFooterIcons((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const input = {
      legalName: legalName.trim(),
      vatNumber: vatNumber.trim() || undefined,
      taxCode: taxCode.trim() || undefined,
      address: { street: street.trim(), zip: zip.trim(), city: city.trim(), country: country.trim() },
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      pec: pec.trim() || undefined,
      sdi: sdi.trim() || undefined,
      iban: iban.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      footerIcons: footerIcons.filter((i) => i.label.trim() && i.value.trim()),
      defaultVatPercent: Number(defaultVatPercent),
      pdfAccentHex: pdfAccentHex || undefined,
      footerNote: footerNote.trim() || undefined,
    }

    const result = SaveCompanySettingsSchema.safeParse(input)
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        errs[key] = issue.message
      }
      setErrors(errs)
      return
    }
    setErrors({})

    startTransition(async () => {
      try {
        await saveCompanySettings(result.data)
        toast.success('Dati azienda salvati')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Non sono riuscito a salvare. Riprova.')
      }
    })
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const uid = getAuth(clientApp).currentUser?.uid
    if (!uid) { toast.error('Utente non autenticato.'); return }

    const ext = file.name.split('.').pop() ?? 'png'
    const path = `users/${uid}/logo/logo.${ext}`
    const storageRef = ref(getStorage(clientApp), path)
    const task = uploadBytesResumable(storageRef, file)

    setLogoUploading(true)
    setLogoProgress(0)
    task.on(
      'state_changed',
      (snap) => setLogoProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { toast.error(`Upload fallito: ${err.message}`); setLogoUploading(false) },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        setLogoUrl(url)
        setLogoUploading(false)
        toast.success('Logo caricato — ricorda di salvare.')
      },
    )
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Anagrafica ── */}
      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Anagrafica</h2>
        <div>
          <label className={labelCls}>
            Nome o ragione sociale <span className="text-[var(--color-danger)]">*</span>
          </label>
          <input
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            aria-invalid={!!errors.legalName}
            className={fieldCls(errors.legalName)}
            placeholder="Es. Mario Rossi"
            autoFocus
          />
          {errors.legalName && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.legalName}</p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Partita IVA</label>
            <input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              className={fieldCls()}
              placeholder="IT12345678901"
            />
          </div>
          <div>
            <label className={labelCls}>Codice Fiscale</label>
            <input
              type="text"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              className={fieldCls()}
              placeholder="RSSMRA80A01H501U"
            />
          </div>
        </div>
      </section>

      {/* ── Indirizzo ── */}
      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Indirizzo</h2>
        <div>
          <label className={labelCls}>Via / Piazza</label>
          <input
            type="text"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            className={fieldCls()}
            placeholder="Via Roma 1"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>CAP</label>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className={fieldCls()}
              placeholder="00100"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className={labelCls}>Città</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={fieldCls()}
              placeholder="Roma"
            />
          </div>
        </div>
        <div className="max-w-[200px]">
          <label className={labelCls}>Paese</label>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={fieldCls()}
            placeholder="Italia"
          />
        </div>
      </section>

      {/* ── Contatti ── */}
      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Contatti</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              className={fieldCls(errors.email)}
              placeholder="mario@esempio.it"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Telefono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={fieldCls()}
              placeholder="+39 06 1234567"
            />
          </div>
          <div>
            <label className={labelCls}>PEC</label>
            <input
              type="email"
              value={pec}
              onChange={(e) => setPec(e.target.value)}
              className={fieldCls()}
              placeholder="mario@pec.it"
            />
          </div>
          <div>
            <label className={labelCls}>Codice SDI</label>
            <input
              type="text"
              value={sdi}
              onChange={(e) => setSdi(e.target.value)}
              className={fieldCls()}
              placeholder="ABCDEFG"
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>IBAN</label>
          <input
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            className={fieldCls()}
            placeholder="IT60 X054 2811 1010 0000 0123 456"
          />
        </div>
      </section>

      {/* ── Logo ── */}
      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>Logo</h2>
        <p className="text-xs text-[var(--color-fg-faint)]">
          PNG o SVG con sfondo trasparente consigliato. Max 2 MB. Nel PDF viene inserito in un riquadro quadrato 56 pt × 56 pt (~75 px) — usa un&apos;immagine quadrata per il risultato migliore.
        </p>

        {/* Hidden file input */}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoFileChange}
        />

        <div className="flex items-center gap-3 flex-wrap">
          {/* Upload button */}
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            className="flex items-center gap-2 h-9 px-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-fg-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:opacity-50 transition-colors"
          >
            <Upload size={14} />
            {logoUploading ? `Caricamento ${logoProgress}%…` : logoUrl ? 'Sostituisci logo' : 'Carica logo'}
          </button>

          {/* Remove button */}
          {logoUrl && !logoUploading && (
            <button
              type="button"
              onClick={() => setLogoUrl('')}
              className="flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-sm text-[var(--color-fg-faint)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)] transition-colors"
            >
              <X size={14} /> Rimuovi
            </button>
          )}
        </div>

        {/* Progress bar */}
        {logoUploading && (
          <div className="h-1.5 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${logoProgress}%` }}
            />
          </div>
        )}

        {/* Preview */}
        {logoUrl && !logoUploading && (
          <div className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Anteprima logo"
              className="h-10 w-auto max-w-[200px] object-contain"
            />
          </div>
        )}
      </section>

      {/* ── Footer PDF ── */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitleCls}>Footer PDF</h2>
          <span className="text-xs text-[var(--color-fg-faint)]">{footerIcons.length}/6</span>
        </div>
        <p className="text-xs text-[var(--color-fg-faint)]">
          Link o dati che appaiono in fondo a ogni pagina del preventivo.
        </p>
        <div className="space-y-3">
          {footerIcons.map((icon, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3"
            >
              <GripVertical size={16} className="mt-3 shrink-0 text-[var(--color-fg-faint)]" />
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={icon.kind}
                  onChange={(e) => updateIcon(i, { kind: e.target.value as FooterIconKind })}
                  className={fieldCls()}
                  aria-label="Tipo icona"
                >
                  {(Object.keys(ICON_KIND_LABELS) as FooterIconKind[]).map((k) => (
                    <option key={k} value={k}>
                      {ICON_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={icon.label}
                  onChange={(e) => updateIcon(i, { label: e.target.value })}
                  className={fieldCls()}
                  placeholder="Etichetta"
                  aria-label="Etichetta"
                />
                <input
                  type="text"
                  value={icon.value}
                  onChange={(e) => updateIcon(i, { value: e.target.value })}
                  className={fieldCls()}
                  placeholder="URL o testo"
                  aria-label="Valore"
                />
              </div>
              <button
                type="button"
                onClick={() => removeIcon(i)}
                className="mt-2.5 shrink-0 p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-accent-soft)] transition-colors"
                aria-label="Rimuovi"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        {footerIcons.length < 6 && (
          <button
            type="button"
            onClick={addIcon}
            className="flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
          >
            <Plus size={14} />
            Aggiungi
          </button>
        )}
      </section>

      {/* ── PDF ── */}
      <section className={sectionCls}>
        <h2 className={sectionTitleCls}>PDF</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>IVA predefinita (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={defaultVatPercent}
              onChange={(e) => setDefaultVatPercent(e.target.value)}
              aria-invalid={!!errors.defaultVatPercent}
              className={fieldCls(errors.defaultVatPercent)}
            />
            {errors.defaultVatPercent && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.defaultVatPercent}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Colore accento PDF</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={pdfAccentHex}
                onChange={(e) => setPdfAccentHex(e.target.value)}
                className="h-11 w-14 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 cursor-pointer"
                aria-label="Colore accento PDF"
              />
              <input
                type="text"
                value={pdfAccentHex}
                onChange={(e) => setPdfAccentHex(e.target.value)}
                aria-invalid={!!errors.pdfAccentHex}
                className={`${fieldCls(errors.pdfAccentHex)} font-mono flex-1`}
                placeholder="#3b6fd4"
              />
            </div>
            {errors.pdfAccentHex && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.pdfAccentHex}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Nota footer PDF</label>
            <textarea
              rows={2}
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              className={`${fieldCls(undefined)} resize-none`}
              placeholder="es. Regime forfettario — IVA non applicata ex L. 190/2014 — Preventivo valido 30 giorni"
            />
            <p className="mt-1 text-xs text-[var(--color-fg-faint)]">Testo libero inserito nel footer di ogni pagina del PDF, prima del numero di pagina.</p>
          </div>
        </div>
      </section>

      {/* ── Azioni ── */}
      <div className="flex justify-end gap-3 pb-8">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center h-11 px-6 rounded-[var(--radius)] bg-[var(--color-accent)] text-[var(--color-accent-fg)] text-[15px] font-medium transition-all duration-[120ms] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
        >
          {isPending ? 'Salvataggio…' : 'Salva'}
        </button>
      </div>
    </form>
  )
}
