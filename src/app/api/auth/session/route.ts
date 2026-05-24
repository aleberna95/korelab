import { NextRequest, NextResponse } from 'next/server'
import { createSessionCookie, sessionCookieOptions } from '@/lib/auth/session'

// POST /api/auth/session — exchange Firebase ID token for a session cookie
export async function POST(request: NextRequest): Promise<NextResponse> {
  let idToken: string
  let rememberMe: boolean

  try {
    const body = await request.json()
    idToken = body.idToken
    rememberMe = body.rememberMe === true
    if (typeof idToken !== 'string' || !idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const sessionCookie = await createSessionCookie(idToken)

    const response = NextResponse.json({ ok: true })
    // rememberMe=true → persistent cookie with maxAge (5 days)
    // rememberMe=false → session cookie (expires when browser closes)
    const { maxAge: _maxAge, ...baseOptions } = sessionCookieOptions
    response.cookies.set({
      ...baseOptions,
      ...(rememberMe ? { maxAge: sessionCookieOptions.maxAge } : {}),
      value: sessionCookie,
    })
    return response
  } catch (err) {
    console.error('[auth/session] Failed to create session cookie:', err)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// DELETE /api/auth/session — clear the session cookie (logout)
export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    ...sessionCookieOptions,
    value: '',
    maxAge: 0,
  })
  return response
}
