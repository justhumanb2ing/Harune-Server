import type { JwtOptions } from 'better-auth/plugins'

export const jwtOptions = {
  jwt: {
    audience: 'authenticated',
    expirationTime: '15m',
    definePayload: ({ user }) => ({
      email: user.email,
      role: 'authenticated',
    }),
    getSubject: ({ user }) => user.id,
  },
} satisfies JwtOptions
