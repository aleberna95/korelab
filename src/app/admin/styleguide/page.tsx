'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useTheme } from '@/components/theme/ThemeProvider'
import { Sun, Moon, CircleCheck, CircleAlert, CircleDashed } from 'lucide-react'

export default function StyleguidePage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [inputVal, setInputVal] = useState('')

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-2xl space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-display">Styleguide</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Cambia tema"
          >
            {resolvedTheme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>

        <Separator />

        {/* Typography */}
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Tipografia</p>
          <p className="text-display">Display — 28 / 36px</p>
          <p className="text-h1">Heading 1 — 22 / 24px</p>
          <p className="text-h2">Heading 2 — 17 / 18px</p>
          <p className="text-[15px] leading-[1.375rem]">Body — 15px normale</p>
          <p className="text-[13px] text-[var(--color-fg-muted)]">Small / muted — 13px</p>
          <p className="text-[11px] text-[var(--color-fg-faint)]">Extra small / faint — 11px</p>
        </section>

        <Separator />

        {/* Buttons */}
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Bottoni</p>
          <div className="flex flex-wrap gap-3">
            <Button>Primario</Button>
            <Button variant="secondary">Secondario</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Distruttivo</Button>
            <Button disabled>Disabilitato</Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm">Piccolo</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Grande</Button>
            <Button size="icon" aria-label="Icona"><CircleCheck className="size-5" /></Button>
          </div>
        </section>

        <Separator />

        {/* Inputs */}
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Input</p>
          <div className="space-y-2">
            <Label htmlFor="demo-input">Nome</Label>
            <Input id="demo-input" placeholder="Scrivi qualcosa…" value={inputVal} onChange={e => setInputVal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-textarea">Note</Label>
            <Textarea id="demo-textarea" placeholder="Testo libero…" rows={3} />
          </div>
        </section>

        <Separator />

        {/* Cards */}
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Card</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Mario Rossi</CardTitle>
                <CardDescription>mario@rossi.it · +39 333 1234567</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge>#vip</Badge>
                  <Badge variant="secondary">#ecommerce</Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="opacity-50">
              <CardHeader>
                <CardTitle>Skeleton loading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        {/* Badges & Status */}
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Badge & stato</p>
          <div className="flex flex-wrap gap-3 items-center">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Distruttivo</Badge>
            <span className="flex items-center gap-1.5 text-[var(--color-success)]"><CircleCheck className="size-4" />Tutto a posto</span>
            <span className="flex items-center gap-1.5 text-[var(--color-danger)]"><CircleAlert className="size-4" />Giù</span>
            <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]"><CircleDashed className="size-4" />In attesa…</span>
          </div>
        </section>

        <Separator />

        {/* Toast */}
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Toast (Sonner)</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.success('Cliente salvato')}>Success</Button>
            <Button variant="outline" onClick={() => toast.error('Non sono riuscito a salvare. Riprova.')}>Error</Button>
            <Button variant="outline" onClick={() => toast('Nota eliminata', { action: { label: 'Annulla', onClick: () => toast('Azione annullata') } })}>Con undo</Button>
          </div>
        </section>

        <Separator />

        {/* Dialog */}
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Dialog</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Apri dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eliminare questa nota?</DialogTitle>
              </DialogHeader>
              <p className="text-[var(--color-fg-muted)] text-[15px]">Questa azione non può essere annullata.</p>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost">Annulla</Button>
                <Button variant="destructive">Elimina</Button>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        {/* Task colors */}
        <Separator />
        <section className="space-y-3">
          <p className="text-[var(--color-fg-muted)] text-sm uppercase tracking-widest font-medium">Palette task</p>
          <div className="flex flex-wrap gap-2">
            {(['yellow','pink','blue','green','purple','orange','gray'] as const).map(c => (
              <div
                key={c}
                className="rounded-[var(--radius-lg)] p-4 text-[13px] font-medium w-24 text-center"
                style={{ background: `var(--color-task-${c})`, color: 'var(--color-fg)' }}
              >
                {c}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
