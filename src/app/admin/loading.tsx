/**
 * Admin loading UI — shown instantly by Next.js via Suspense while any admin
 * page is streaming from the server. Prevents the browser from appearing frozen
 * during navigation.
 */
export default function AdminLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 animate-pulse">
      {/* Page title skeleton */}
      <div className="h-7 w-48 bg-gray-200 rounded-md" />

      {/* Content rows skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>
    </div>
  )
}
