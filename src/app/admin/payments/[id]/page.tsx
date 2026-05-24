import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { paymentsRepo } from '@/lib/repos/paymentsRepo'
import { PaymentDetail } from '@/components/payments/PaymentDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PaymentPage({ params }: Props) {
  await requireAdmin()

  const { id } = await params
  const payment = await paymentsRepo.getById(id)
  if (!payment) notFound()

  return <PaymentDetail initialPayment={payment} />
}
