import {
  insertShare,
  listShares,
  resolveUserByEmail,
  revokeShare as revokeShareRow,
} from '@/lib/db'
import type { ShareRow } from '@/lib/types'

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function createPublicLink(reportId: string): Promise<string> {
  const token = crypto.randomUUID()
  const hash = await sha256Hex(token)
  await insertShare({ reportId, shareType: 'public_link', tokenHash: hash })
  return `/r/${token}`
}

export async function grantUser(reportId: string, email: string): Promise<void> {
  const grantedTo = await resolveUserByEmail(email)
  await insertShare({ reportId, shareType: 'user', grantedTo })
}

export async function listSharesForReport(reportId: string): Promise<ShareRow[]> {
  return listShares(reportId)
}

export async function revokeShare(shareId: string): Promise<void> {
  await revokeShareRow(shareId)
}