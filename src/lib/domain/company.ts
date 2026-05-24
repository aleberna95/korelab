// ─── Company settings domain types ──────────────────────────────────────────
// Stored at: users/{uid}/settings/company

export type FooterIconKind =
  | 'website'
  | 'email'
  | 'phone'
  | 'instagram'
  | 'linkedin'
  | 'custom'

export interface CompanyFooterIcon {
  kind: FooterIconKind
  label: string
  value: string   // URL or plain text
}

export interface CompanyAddress {
  street?: string
  zip?: string
  city?: string
  country?: string  // default "Italia"
}

export interface CompanySettings {
  legalName: string
  vatNumber?: string  // P.IVA
  taxCode?: string    // CF
  address?: CompanyAddress
  email?: string
  phone?: string
  iban?: string
  pec?: string
  sdi?: string        // Codice Destinatario SDI
  logoUrl?: string    // Firebase Storage URL
  footerIcons?: CompanyFooterIcon[]  // max 6
  defaultVatPercent: number          // default 5
  pdfAccentHex?: string              // hex color, default maps to --color-accent token
  footerNote?: string                // testo libero visualizzato nel footer PDF
}
