import { requireAdmin } from '@/lib/auth/guards'
import { paymentsRepo } from '@/lib/repos/paymentsRepo'
import { PaymentsList } from '@/components/payments/PaymentsList'

export default async function PaymentsPage() {
  await requireAdmin()

  const payments = await paymentsRepo.list({ limit: 200 })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <PaymentsList initialPayments={payments} />
    </div>
  )
}
