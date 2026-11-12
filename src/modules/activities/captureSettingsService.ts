import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { CaptureSettings } from '../../models'

// Cualquier otro campo que pudiera haber en el documento se ignora.
export function normalizeSettings(uid: string, data: Record<string, unknown> | undefined): CaptureSettings {
  return {
    userId: uid,
    excludedDomains: Array.isArray(data?.excludedDomains) ? (data!.excludedDomains as string[]) : [],
    updatedAt: typeof data?.updatedAt === 'number' ? data.updatedAt : 0,
  }
}

export function subscribeCaptureSettings(uid: string, callback: (s: CaptureSettings) => void): () => void {
  return onSnapshot(doc(db, 'captureSettings', uid), (snap) => callback(normalizeSettings(uid, snap.exists() ? snap.data() : undefined)))
}

// merge: solo se escriben los campos indicados; lo demás del documento se conserva.
export function saveCaptureSettings(uid: string, partial: Partial<Pick<CaptureSettings, 'excludedDomains'>>) {
  return setDoc(doc(db, 'captureSettings', uid), { userId: uid, ...partial, updatedAt: Date.now() }, { merge: true })
}
