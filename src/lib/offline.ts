import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { GuestSessionRecord } from './types'

const DB_NAME = 'converge'
const DB_VERSION = 1
const STORE = 'guest-session'
const GUEST_KEY = 'current'

export const GUEST_SESSION_EVENT = 'converge:guest-session-changed'

interface ConvergeDB extends DBSchema {
  'guest-session': {
    key: string
    value: GuestSessionRecord
  }
}

let dbPromise: Promise<IDBPDatabase<ConvergeDB>> | null = null

function getDb(): Promise<IDBPDatabase<ConvergeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ConvergeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

function notifyGuestSessionChanged() {
  window.dispatchEvent(new Event(GUEST_SESSION_EVENT))
}

export async function readGuestSession(): Promise<GuestSessionRecord | null> {
  const db = await getDb()
  return (await db.get(STORE, GUEST_KEY)) ?? null
}

export async function saveGuestSession(record: GuestSessionRecord): Promise<void> {
  const db = await getDb()
  await db.put(STORE, record, GUEST_KEY)
  notifyGuestSessionChanged()
}

export async function clearGuestSession(): Promise<void> {
  const db = await getDb()
  await db.delete(STORE, GUEST_KEY)
  notifyGuestSessionChanged()
}
