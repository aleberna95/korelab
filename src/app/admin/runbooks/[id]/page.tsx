import { requireAdmin } from '@/lib/auth/guards'
import { runbooksRepo } from '@/lib/repos/runbooksRepo'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const RISK_STYLES = {
  low: 'text-green-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
}

type Props = { params: Promise<{ id: string }> }

export default async function RunbookDetailPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params

  const runbook = await runbooksRepo.getById(id)
  if (!runbook) notFound()

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/admin/runbooks" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Runbooks
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{runbook.title}</h1>
          <Link
            href={`/admin/runbooks/${runbook.id}/edit`}
            className="shrink-0 text-sm bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg"
          >
            Edit
          </Link>
        </div>
        {runbook.notes && (
          <p className="mt-2 text-zinc-400 text-sm">{runbook.notes}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {runbook.serviceTypes.map((t) => (
            <span key={t} className="text-xs bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">{t}</span>
          ))}
          {runbook.appliesToTags.map((t) => (
            <span key={t} className="text-xs bg-zinc-700/60 text-zinc-400 px-2 py-0.5 rounded">#{t}</span>
          ))}
        </div>
      </div>

      {/* First checks */}
      {runbook.firstChecks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">First checks</h2>
          <ul className="space-y-1.5">
            {runbook.firstChecks.map((check, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-zinc-600 shrink-0">{i + 1}.</span>
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Common failures */}
      {runbook.commonFailures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Common failures
          </h2>
          <div className="space-y-2">
            {runbook.commonFailures.map((f, i) => (
              <div key={i} className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3">
                <p className="font-medium text-sm text-white">{f.symptom}</p>
                {f.likelyCause && (
                  <p className="text-xs text-zinc-400 mt-0.5">
                    <span className="text-zinc-500">Cause: </span>{f.likelyCause}
                  </p>
                )}
                {f.fix && (
                  <p className="text-xs text-zinc-300 mt-1">
                    <span className="text-zinc-500">Fix: </span>{f.fix}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recovery steps */}
      {runbook.recoverySteps.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Recovery steps
          </h2>
          <div className="space-y-3">
            {runbook.recoverySteps.map((step, i) => (
              <div
                key={i}
                className="bg-zinc-800/60 border border-zinc-700 rounded-xl px-5 py-4"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-700 text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <span className={`ml-auto text-xs capitalize ${RISK_STYLES[step.riskLevel]}`}>
                    {step.riskLevel} risk
                  </span>
                </div>
                {step.body && (
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap pl-8.5">{step.body}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contacts */}
      {runbook.contacts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Contacts</h2>
          <ul className="space-y-1">
            {runbook.contacts.map((c, i) => (
              <li key={i} className="text-sm text-zinc-300">{c}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Links */}
      {runbook.links.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Links</h2>
          <ul className="space-y-1">
            {runbook.links.map((link, i) => (
              <li key={i}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline break-all"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
