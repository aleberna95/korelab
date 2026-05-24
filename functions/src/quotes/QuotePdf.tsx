import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'

// Disable hyphenation globally — prevents mid-word line breaks
Font.registerHyphenationCallback((word) => [word])
import type { QuoteData, CompanyData, QuoteDiscount } from './types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function eur(cents: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface DiscountRow extends QuoteDiscount {
  appliedCents: number
  runningCents: number
}

function computeDiscountRows(discounts: QuoteDiscount[], subtotal: number): DiscountRow[] {
  let running = subtotal
  return discounts.map((d) => {
    const applied =
      d.kind === 'percent' ? Math.round(running * (d.value / 100)) : Math.min(d.value, running)
    running -= applied
    const row: DiscountRow = { ...d, appliedCents: applied, runningCents: running }
    return row
  })
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'settimanali',
  monthly: 'mensili',
  quarterly: 'trimestrali',
  semiannual: 'semestrali',
  yearly: 'annuali',
  custom: 'personalizzate',
}

function buildPaymentLines(quote: QuoteData): string[] {
  const { payment, totals } = quote
  const lines: string[] = []
  const accontoCents = payment.acconto?.amountCents ?? 0
  const netCents = totals.totalCents - accontoCents

  // Determine quote date so we can skip past/impossible due dates
  const quoteDate =
    typeof quote.createdAt === 'string'
      ? quote.createdAt
      : quote.createdAt.toDate().toISOString().slice(0, 10)

  if (payment.acconto) {
    let line = `Acconto: ${eur(accontoCents)}`
    const due = payment.acconto.expectedDate
    if (due && due >= quoteDate) line += ` (entro ${fmtDate(due)})`
    lines.push(line)
  }

  if (payment.mode === 'lump-sum') {
    lines.push(
      accontoCents > 0
        ? `Saldo: ${eur(netCents)}`
        : 'Pagamento in unica soluzione',
    )
  } else if (payment.installments) {
    const { count, cadence, firstInstallmentDate } = payment.installments
    const rateAmount = Math.floor(netCents / count)
    const cadenceLabel = CADENCE_LABELS[cadence] ?? cadence
    let line = `${count} rate ${cadenceLabel} da ${eur(rateAmount)} ciascuna`
    if (firstInstallmentDate) line += ` (prima rata: ${fmtDate(firstInstallmentDate)})`
    lines.push(line)
  }

  return lines
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(accent: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 48,
      paddingBottom: 60,
      paddingHorizontal: 40,
      fontSize: 9.5,
      fontFamily: 'Helvetica',
      color: '#111827',
    },
    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 28,
    },
    logoBox: { width: 56, height: 56 },
    companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: accent, marginBottom: 2 },
    companyMeta: { fontSize: 8, color: '#6B7280', lineHeight: 1.4 },
    quoteLabel: { fontSize: 8, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
    quoteNumber: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: accent, marginTop: 2 },
    quoteDate: { fontSize: 8.5, color: '#6B7280', marginTop: 4 },
    // Section heading
    sectionTitle: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
      marginTop: 16,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
    },
    // Client block
    clientName: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
    clientMeta: { color: '#6B7280', fontSize: 8.5, lineHeight: 1.5 },
    // Table
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: accent,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 2,
      marginTop: 4,
    },
    tableHeaderText: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#ffffff' },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: '#F3F4F6',
    },
    tableRowAlt: { backgroundColor: '#F9FAFB' },
    tableCell: { fontSize: 9 },
    colN: { width: '5%' },
    colDesc: { width: '55%' },
    colQty: { width: '10%', textAlign: 'right' },
    colPrice: { width: '15%', textAlign: 'right' },
    colTotal: { width: '15%', textAlign: 'right' },
    // Totals
    totalsBlock: { alignItems: 'flex-end', marginTop: 12 },
    totalsRow: { flexDirection: 'row', justifyContent: 'space-between', minWidth: 200, paddingVertical: 2 },
    totalsLabel: { fontSize: 9, color: '#6B7280', paddingRight: 16 },
    totalsValue: { fontSize: 9 },
    totalsDivider: { width: 200, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB', marginVertical: 4 },
    grandTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
    grandTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: accent },
    // Notes
    notesText: { fontSize: 9, fontFamily: 'Helvetica-Oblique', color: '#374151', lineHeight: 1.5 },
    // Footer
    footer: {
      position: 'absolute',
      bottom: 20,
      left: 40,
      right: 40,
      borderTopWidth: 0.5,
      borderTopColor: '#E5E7EB',
      paddingTop: 5,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerText: { fontSize: 7, color: '#9CA3AF' },
    // Watermark
    watermark: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    watermarkText: {
      fontSize: 100,
      fontFamily: 'Helvetica-Bold',
      color: '#E5E7EB',
      opacity: 0.4,
      transform: 'rotate(-45deg)',
    },
    // Signature page
    sigBlock: { marginTop: 32 },
    sigTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
    sigLine: { borderBottomWidth: 0.5, borderBottomColor: '#374151', marginTop: 40, marginBottom: 4 },
    sigLabel: { fontSize: 8, color: '#6B7280' },
    sigRow: { flexDirection: 'row', gap: 24, marginTop: 24 },
    paymentLine: { fontSize: 9, color: '#374151', lineHeight: 1.6, marginBottom: 4 },
    // Fiscal note
    fiscalNote: {
      marginTop: 8,
      marginBottom: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: '#F9FAFB',
      borderRadius: 2,
      borderLeftWidth: 2,
      borderLeftColor: '#D1D5DB',
    },
    fiscalNoteText: { fontSize: 7.5, color: '#6B7280', fontFamily: 'Helvetica-Oblique', lineHeight: 1.5 },
    // Conditions / Privacy
    conditionText: { fontSize: 8.5, color: '#374151', lineHeight: 1.65, marginBottom: 10 },
    specificApprovalText: { fontSize: 8, color: '#374151', lineHeight: 1.6 },
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PdfHeader({ quote, company, accent, styles }: {
  quote: QuoteData
  company: CompanyData | null
  accent: string
  styles: ReturnType<typeof makeStyles>
}) {
  const addr = company?.address
  const addrLine = [addr?.street, addr?.zip && addr?.city ? `${addr.zip} ${addr.city}` : addr?.city]
    .filter(Boolean).join(' — ')

  const createdAt =
    typeof quote.createdAt === 'string'
      ? quote.createdAt
      : quote.createdAt.toDate().toISOString().slice(0, 10)

  return (
    <View style={styles.header}>
      <View>
        {company?.logoUrl ? (
          <Image src={company.logoUrl} style={styles.logoBox} />
        ) : (
          <Text style={{ ...styles.companyName, color: accent }}>
            {company?.legalName ?? 'Azienda'}
          </Text>
        )}
        {company?.legalName && company.logoUrl && (
          <Text style={styles.companyName}>{company.legalName}</Text>
        )}
        <Text style={styles.companyMeta}>
          {[company?.vatNumber && `P.IVA ${company.vatNumber}`, addrLine].filter(Boolean).join(' | ')}
        </Text>
        {company?.email && <Text style={styles.companyMeta}>{company.email}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.quoteLabel}>Preventivo</Text>
        <Text style={styles.quoteNumber}>{quote.number}</Text>
        <Text style={styles.quoteDate}>{fmtDate(createdAt)}</Text>
      </View>
    </View>
  )
}

function ClientSection({ quote, styles }: {
  quote: QuoteData
  styles: ReturnType<typeof makeStyles>
}) {
  const c = quote.clientSnapshot
  const contactParts = [c.email, c.phone].filter(Boolean)
  const fiscalParts = [
    c.vatNumber && `P.IVA ${c.vatNumber}`,
    c.taxCode && `C.F. ${c.taxCode}`,
  ].filter(Boolean)
  return (
    <View>
      <Text style={styles.sectionTitle}>Destinatario</Text>
      <Text style={styles.clientName}>{c.name}</Text>
      {c.address ? <Text style={styles.clientMeta}>{c.address}</Text> : null}
      {contactParts.length > 0 && (
        <Text style={styles.clientMeta}>{contactParts.join(' | ')}</Text>
      )}
      {fiscalParts.length > 0 && (
        <Text style={styles.clientMeta}>{fiscalParts.join(' | ')}</Text>
      )}
      {c.pec ? <Text style={styles.clientMeta}>PEC: {c.pec}</Text> : null}
      {c.sdi ? <Text style={styles.clientMeta}>SDI: {c.sdi}</Text> : null}
    </View>
  )
}

function LinesTable({ quote, styles }: {
  quote: QuoteData
  styles: ReturnType<typeof makeStyles>
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Prestazioni</Text>
      <View style={styles.tableHeader}>
        <Text style={{ ...styles.tableHeaderText, ...styles.colN }}>#</Text>
        <Text style={{ ...styles.tableHeaderText, ...styles.colDesc }}>Descrizione</Text>
        <Text style={{ ...styles.tableHeaderText, ...styles.colQty }}>Qtà</Text>
        <Text style={{ ...styles.tableHeaderText, ...styles.colPrice }}>Prezzo</Text>
        <Text style={{ ...styles.tableHeaderText, ...styles.colTotal }}>Totale</Text>
      </View>
      {quote.lines.map((line, i) => (
        <View
          key={line.id}
          style={i % 2 === 1 ? { ...styles.tableRow, ...styles.tableRowAlt } : styles.tableRow}
          wrap={false}
        >
          <Text style={{ ...styles.tableCell, ...styles.colN }}>{i + 1}</Text>
          <Text style={{ ...styles.tableCell, ...styles.colDesc }}>{line.description}</Text>
          <Text style={{ ...styles.tableCell, ...styles.colQty }}>{line.qty}</Text>
          <Text style={{ ...styles.tableCell, ...styles.colPrice }}>{eur(line.unitPriceCents)}</Text>
          <Text style={{ ...styles.tableCell, ...styles.colTotal }}>
            {eur(line.qty * line.unitPriceCents)}
          </Text>
        </View>
      ))}
    </View>
  )
}

function TotalsSection({ quote, styles, accent }: {
  quote: QuoteData
  styles: ReturnType<typeof makeStyles>
  accent: string
}) {
  const { totals, discounts, vatPercent } = quote
  const discountRows = computeDiscountRows(discounts, totals.subtotalCents)

  return (
    <View style={styles.totalsBlock}>
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotale</Text>
        <Text style={styles.totalsValue}>{eur(totals.subtotalCents)}</Text>
      </View>
      {discountRows.map((dr) => (
        <View key={dr.id} style={styles.totalsRow}>
          <Text style={{ ...styles.totalsLabel, color: '#DC2626' }}>
            {dr.label}
            {dr.kind === 'percent' ? ` (${dr.value}%)` : ''}
          </Text>
          <Text style={{ ...styles.totalsValue, color: '#DC2626' }}>-{eur(dr.appliedCents)}</Text>
        </View>
      ))}
      {discounts.length > 0 && (
        <>
          <View style={styles.totalsDivider} />
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Imponibile</Text>
            <Text style={styles.totalsValue}>{eur(totals.taxableCents)}</Text>
          </View>
        </>
      )}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>
          {vatPercent === 0 ? 'IVA non applicata' : `IVA ${vatPercent}%`}
        </Text>
        <Text style={styles.totalsValue}>
          {vatPercent === 0 ? '\u2014' : eur(totals.vatCents)}
        </Text>
      </View>
      <View style={styles.totalsDivider} />
      <View style={styles.totalsRow}>
        <Text style={{ ...styles.grandTotalLabel }}>TOTALE</Text>
        <Text style={{ ...styles.grandTotalValue, color: accent }}>{eur(totals.totalCents)}</Text>
      </View>
    </View>
  )
}

function NotesSection({ notes, styles }: { notes: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Note</Text>
      <Text style={styles.notesText}>{notes}</Text>
    </View>
  )
}

function SignaturePage({ quote, company, styles, accent }: {
  quote: QuoteData
  company: CompanyData | null
  accent: string
  styles: ReturnType<typeof makeStyles>
}) {
  const paymentLines = buildPaymentLines(quote)
  const { totals, vatPercent } = quote
  const isForfettario = vatPercent === 0

  return (
    <View>
      <Text style={{ ...styles.sectionTitle, marginTop: 0 }}>Riepilogo economico</Text>

      <View style={styles.totalsBlock}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Totale prestazioni</Text>
          <Text style={styles.totalsValue}>{eur(totals.subtotalCents)}</Text>
        </View>
        {totals.discountTotalCents > 0 && (
          <View style={styles.totalsRow}>
            <Text style={{ ...styles.totalsLabel, color: '#DC2626' }}>Sconti applicati</Text>
            <Text style={{ ...styles.totalsValue, color: '#DC2626' }}>
              -{eur(totals.discountTotalCents)}
            </Text>
          </View>
        )}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Imponibile</Text>
          <Text style={styles.totalsValue}>{eur(totals.taxableCents)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>
            {isForfettario ? 'IVA non applicata' : `IVA ${vatPercent}%`}
          </Text>
          <Text style={styles.totalsValue}>
            {isForfettario ? '\u2014' : eur(totals.vatCents)}
          </Text>
        </View>
        <View style={styles.totalsDivider} />
        <View style={styles.totalsRow}>
          <Text style={styles.grandTotalLabel}>TOTALE</Text>
          <Text style={{ ...styles.grandTotalValue, color: accent }}>{eur(totals.totalCents)}</Text>
        </View>
      </View>

      {isForfettario && (
        <View style={styles.fiscalNote}>
          <Text style={styles.fiscalNoteText}>
            Operazione senza applicazione dell&apos;IVA ai sensi dell&apos;art. 1, commi 54-89,
            L. 190/2014 — regime forfettario.
          </Text>
          <Text style={{ ...styles.fiscalNoteText, marginTop: 3 }}>
            Compenso non soggetto a ritenuta d&apos;acconto ai sensi dell&apos;art. 1, comma 67,
            L. 190/2014.
          </Text>
          <Text style={{ ...styles.fiscalNoteText, marginTop: 3 }}>
            Eventuale imposta di bollo su fattura elettronica, ove dovuta, pari a € 2,00.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Modalità di pagamento</Text>
      {paymentLines.map((line, i) => (
        <Text key={i} style={styles.paymentLine}>{line}</Text>
      ))}
      {company?.iban && (
        <Text style={{ ...styles.paymentLine, marginTop: 4 }}>IBAN: {company.iban}</Text>
      )}

      <ConditionsSection styles={styles} />
      <PrivacySection styles={styles} />
      <SoftwareSection styles={styles} />

      <View style={styles.sigBlock} wrap={false}>
        <Text style={styles.sectionTitle}>Accettazione preventivo</Text>
        <Text style={{ fontSize: 8.5, color: '#6B7280', marginBottom: 8 }}>
          Il/La sottoscritto/a dichiara di accettare integralmente il presente preventivo, le
          prestazioni indicate, le condizioni economiche, le modalità di pagamento e le condizioni
          operative riportate nel documento.
        </Text>
        <View style={styles.sigRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Data e luogo</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Firma del cliente</Text>
          </View>
        </View>
      </View>

      <View
        style={{ marginTop: 20, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#E5E7EB' }}
        wrap={false}
      >
        <Text style={{ ...styles.sectionTitle, marginTop: 0 }}>
          Approvazione specifica delle condizioni
        </Text>
        <Text style={styles.specificApprovalText}>
          Ai sensi e per gli effetti degli artt. 1341 e 1342 c.c., il cliente dichiara di
          approvare specificamente le clausole relative a: ambito delle prestazioni, esclusioni,
          modalità di pagamento, sospensione delle attività in caso di mancato pagamento,
          assistenza post-consegna, trattamento dati e proprietà/utilizzo del software.
        </Text>
        <View style={{ ...styles.sigRow, marginTop: 16 }}>
          <View style={{ flex: 2 }}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Firma per specifica approvazione</Text>
          </View>
          <View style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  )
}

function ConditionsSection({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>Condizioni del preventivo</Text>
        <Text style={styles.conditionText}>
          Il presente preventivo ha validità di 30 giorni dalla data di emissione.
        </Text>
      </View>
      <Text style={styles.conditionText}>
        L&apos;avvio dei lavori avverrà a seguito dell&apos;accettazione del preventivo e del
        pagamento dell&apos;acconto indicato. Eventuali ritardi nella consegna di materiali,
        contenuti, credenziali, loghi, dati o informazioni richieste al cliente potranno comportare
        uno slittamento delle tempistiche di consegna.
      </Text>
      <Text style={styles.conditionText}>
        Il prezzo indicato comprende esclusivamente le prestazioni descritte nella sezione
        &quot;Prestazioni&quot;. Sono escluse, salvo diverso accordo scritto, nuove funzionalità,
        moduli aggiuntivi, modifiche sostanziali al flusso operativo, integrazioni con servizi terzi,
        migrazioni massive di dati, attività SEO, copywriting, hosting, domini, licenze, costi di
        servizi esterni e manutenzione evolutiva.
      </Text>
      <Text style={styles.conditionText}>
        Il periodo di assistenza incluso, ove previsto nel preventivo, decorre dalla consegna o
        messa online del servizio e comprende la correzione di bug e piccole modifiche UX o logiche
        minori. Non comprende nuove funzionalità, redesign, modifiche strutturali rilevanti o
        attività richieste dopo la scadenza del periodo incluso.
      </Text>
      <Text style={styles.conditionText}>
        Il mancato pagamento degli importi concordati potrà comportare la sospensione delle
        attività, dell&apos;assistenza o degli accessi ai servizi gestiti dal fornitore fino alla
        regolarizzazione degli importi dovuti.
      </Text>
      <Text style={styles.conditionText}>
        L&apos;accettazione del presente preventivo comporta approvazione dell&apos;ambito di
        lavoro, delle condizioni economiche, delle modalità di pagamento e delle condizioni operative
        sopra indicate.
      </Text>
    </View>
  )
}

function PrivacySection({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View wrap={false}>
      <Text style={styles.sectionTitle}>Trattamento dati e privacy</Text>
      <Text style={styles.conditionText}>
        Qualora l&apos;esecuzione del servizio comporti il trattamento di dati personali per conto
        del cliente, le parti si impegnano a regolare separatamente i rispettivi ruoli privacy ai
        sensi del Regolamento UE 2016/679, anche mediante eventuale nomina a Responsabile del
        trattamento ove necessaria.
      </Text>
    </View>
  )
}

function SoftwareSection({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View wrap={false}>
      <Text style={styles.sectionTitle}>Proprietà e utilizzo del software</Text>
      <Text style={styles.conditionText}>
        Salvo diverso accordo scritto, il codice sorgente, le componenti tecniche riutilizzabili,
        le librerie, gli strumenti di sviluppo e il know-how restano di proprietà del fornitore.
        Al cliente viene concesso il diritto di utilizzo del servizio/software per le proprie
        finalità aziendali.
      </Text>
    </View>
  )
}

function PdfFooter({ company, styles }: {
  company: CompanyData | null
  styles: ReturnType<typeof makeStyles>
}) {
  const parts = [
    company?.legalName,
    company?.vatNumber && `P.IVA ${company.vatNumber}`,
    company?.footerNote,
  ].filter(Boolean)

  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>{parts.join(' \u2014 ')}</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Pag. ${pageNumber}/${totalPages}`}
      />
    </View>
  )
}

function DraftWatermark({ styles }: { styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.watermark} fixed>
      <Text style={styles.watermarkText}>BOZZA</Text>
    </View>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface QuotePdfProps {
  quote: QuoteData
  company: CompanyData | null
}

export function QuotePdf({ quote, company }: QuotePdfProps) {
  const accent = company?.pdfAccentHex ?? '#2563EB'
  const styles = makeStyles(accent)
  const isDraft = quote.status === 'bozza'

  return (
    <Document
      title={`Preventivo ${quote.number}`}
      author={company?.legalName}
      subject="Preventivo commerciale"
      creator="KoreLab"
      producer="KoreLab"
    >
      {/* ── Content page(s) ─── */}
      <Page size="A4" style={styles.page}>
        {isDraft && <DraftWatermark styles={styles} />}
        <PdfFooter company={company} styles={styles} />

        <PdfHeader quote={quote} company={company} accent={accent} styles={styles} />
        <ClientSection quote={quote} styles={styles} />
        <LinesTable quote={quote} styles={styles} />
        <TotalsSection quote={quote} styles={styles} accent={accent} />
        {quote.notes && <NotesSection notes={quote.notes} styles={styles} />}
      </Page>

      {/* ── Signature page ─── */}
      <Page size="A4" style={styles.page}>
        {isDraft && <DraftWatermark styles={styles} />}
        <PdfFooter company={company} styles={styles} />

        <PdfHeader quote={quote} company={company} accent={accent} styles={styles} />
        <SignaturePage quote={quote} company={company} accent={accent} styles={styles} />
      </Page>
    </Document>
  )
}

