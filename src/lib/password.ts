import { hashPassword, verifyPassword } from 'better-auth/crypto'

export const hasedPassword = {
  hash: hashPassword,
  verify: verifyPassword,
}
