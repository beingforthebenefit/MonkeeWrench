import {DefaultSession} from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      isAdmin?: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** User id */
    uid?: string
    /** User.sessionVersion when the token was issued */
    sv?: number
  }
}
