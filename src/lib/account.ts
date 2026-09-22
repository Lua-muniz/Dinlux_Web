import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  verifyBeforeUpdateEmail,
  type User,
} from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { auth, db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'
import { markEmailChangeRequested } from './emailChangeNotice'

async function reauthenticate(user: User, password: string) {
  if (!user.email) throw new Error('Usuário não autenticado')
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  } catch {
    throw new Error('Senha atual incorreta')
  }
}

export async function updateName(uid: string, name: string) {
  await setDoc(doc(db, FirestoreCollections.USERS, uid), { nome: name }, { merge: true })
}

export async function requestEmailChange(user: User, newEmail: string, password: string) {
  await reauthenticate(user, password)
  await verifyBeforeUpdateEmail(user, newEmail)
  markEmailChangeRequested(user.email ?? '')
}

export async function changePassword(user: User, currentPassword: string, newPassword: string) {
  await reauthenticate(user, currentPassword)
  await updatePassword(user, newPassword)
}

export async function syncEmailWithAuth(user: User) {
  if (!user.email) return
  const userRef = doc(db, FirestoreCollections.USERS, user.uid)
  const snapshot = await getDoc(userRef)
  if (snapshot.data()?.email !== user.email) {
    await setDoc(userRef, { email: user.email }, { merge: true })
  }
}

export async function loadTermsAcceptance(uid: string): Promise<{ acceptedAt: number | null; version: string | null }> {
  const data = (await getDoc(doc(db, FirestoreCollections.USERS, uid))).data()
  return {
    acceptedAt: typeof data?.termsAcceptedAt === 'number' ? data.termsAcceptedAt : null,
    version: data?.termsVersion != null ? String(data.termsVersion) : null,
  }
}

const USER_SUBCOLLECTIONS = [
  FirestoreCollections.BANKS,
  FirestoreCollections.SIMULATIONS,
  FirestoreCollections.SIMULATION_ENTRIES,
  FirestoreCollections.SIMULATION_GROUPS,
  FirestoreCollections.STATEMENT_TRANSACTIONS,
  FirestoreCollections.LISTS,
  FirestoreCollections.LIST_ITEMS,
]

const BATCH_LIMIT = 400

export async function deleteAccount(user: User, password: string) {
  await reauthenticate(user, password)

  for (const name of USER_SUBCOLLECTIONS) {
    const snapshot = await getDocs(collection(db, FirestoreCollections.USERS, user.uid, name))
    for (let start = 0; start < snapshot.docs.length; start += BATCH_LIMIT) {
      const batch = writeBatch(db)
      snapshot.docs.slice(start, start + BATCH_LIMIT).forEach((item) => batch.delete(item.ref))
      await batch.commit()
    }
  }

  await deleteDoc(doc(db, FirestoreCollections.USERS, user.uid))
  await (auth.currentUser ?? user).delete()
}
