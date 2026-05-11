import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import type { Service } from '@/lib/domain/types'

type Props = {
  services: Service[]
  total?: number
}

export function ServiceTable({ services, total }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {total !== undefined
            ? `Mostra ${services.length} di ${total}`
            : `${services.length} servizio${services.length !== 1 ? 'i' : ''}`}
        </p>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Servizio
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Stato
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ambiente
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Criticità
              </th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Tipo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  Nessun servizio trovato.
                </td>
              </tr>
            )}
            {services.map((svc) => (
              <tr key={svc.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/services/${svc.id}`}
                    className="font-medium text-sm text-gray-900 hover:text-blue-600"
                  >
                    {svc.name}
                  </Link>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">
                    {svc.url ?? ''}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge state={svc.currentStatus.state} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{svc.environment}</td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{svc.criticality}</td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{svc.type.replace(/-/g, ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
