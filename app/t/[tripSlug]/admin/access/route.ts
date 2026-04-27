import { NextResponse } from 'next/server'
import { hasAdminAccess, setAdminCookie } from '@/lib/tenant-data'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tripSlug: string }> }
) {
  const { tripSlug } = await params
  const url = new URL(req.url)
  const adminToken = url.searchParams.get('adminToken') ?? ''
  const redirectUrl = new URL(`/t/${tripSlug}/admin`, url.origin)

  if (!adminToken || !(await hasAdminAccess(tripSlug, adminToken))) {
    redirectUrl.searchParams.set('adminError', 'invalid-admin-link')
    return NextResponse.redirect(redirectUrl)
  }

  await setAdminCookie(tripSlug, adminToken)
  return NextResponse.redirect(redirectUrl)
}
