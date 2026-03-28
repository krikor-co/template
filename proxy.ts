import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth/jwt'

const PUBLIC_PATHS = ['/auth/identify', '/auth/register', '/auth/verify', '/api/auth']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const token = request.cookies.get('session_token')?.value

  if (!token) {
    const loginUrl = new URL('/auth/identify', request.url)
    loginUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    await verifySessionToken(token)
    return NextResponse.next()
  } catch {
    const loginUrl = new URL('/auth/identify', request.url)
    loginUrl.searchParams.set('returnTo', pathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('session_token')
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
