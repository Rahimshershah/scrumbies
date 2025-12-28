import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    '/((?!api/auth|api/invites|api/uploads|login|invite|_next/static|_next/image|uploads|favicon.ico).*)',
  ],
}
