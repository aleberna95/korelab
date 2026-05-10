import { redirect } from 'next/navigation'

/**
 * Root page — redirect to /admin if authenticated,
 * otherwise middleware will handle the redirect to /login.
 */
export default function Home() {
  redirect('/admin')
}
