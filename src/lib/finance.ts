import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import type { DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'
import type { Bank, Card } from './dinluxData'

const BATCH_LIMIT = 400

function userCollection(uid: string, name: string) {
  return collection(db, FirestoreCollections.USERS, uid, name)
}

function bankRef(uid: string, bankId: string) {
  return doc(db, FirestoreCollections.USERS, uid, FirestoreCollections.BANKS, bankId)
}

function serializeCard(card: Card) {
  return {
    id: card.id,
    label: card.label,
    limit: card.limit,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    hasInterest: card.hasInterest,
    interestRate: card.interestRate,
    usedAmount: card.usedAmount,
  }
}

async function deleteAll(refs: DocumentReference[]) {
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    refs.slice(start, start + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

export function newCard(fields: Omit<Card, 'id' | 'usedAmount'>): Card {
  return { ...fields, id: crypto.randomUUID(), usedAmount: 0 }
}

export async function createBank(uid: string, name: string, debit: number, cards: Card[]) {
  await addDoc(userCollection(uid, FirestoreCollections.BANKS), {
    name,
    debit,
    cards: cards.map(serializeCard),
    bankCode: '',
  })
}

export async function updateBankDebit(uid: string, bankId: string, debit: number) {
  await updateDoc(bankRef(uid, bankId), { debit })
}

export async function renameBank(uid: string, bankId: string, name: string) {
  await updateDoc(bankRef(uid, bankId), { name })
}

export async function updateBankCode(uid: string, bankId: string, bankCode: string) {
  await updateDoc(bankRef(uid, bankId), { bankCode })
}

export async function saveCards(uid: string, bankId: string, cards: Card[]) {
  await updateDoc(bankRef(uid, bankId), { cards: cards.map(serializeCard) })
}

async function deleteEntriesAndGroups(uid: string, bankId: string, cardId?: string) {
  const constraints = [where('bankId', '==', bankId), ...(cardId ? [where('cardId', '==', cardId)] : [])]
  const [entries, groups] = await Promise.all([
    getDocs(query(userCollection(uid, FirestoreCollections.SIMULATION_ENTRIES), ...constraints)),
    getDocs(query(userCollection(uid, FirestoreCollections.SIMULATION_GROUPS), ...constraints)),
  ])
  await deleteAll([...entries.docs, ...groups.docs].map((item) => item.ref))
}

export async function deleteStatement(uid: string, bankId: string) {
  const snapshot = await getDocs(
    query(userCollection(uid, FirestoreCollections.STATEMENT_TRANSACTIONS), where('bankId', '==', bankId)),
  )
  await deleteAll(snapshot.docs.map((item) => item.ref))
}

export async function deleteInvoice(uid: string, cardId: string) {
  const snapshot = await getDocs(
    query(userCollection(uid, FirestoreCollections.INVOICE_TRANSACTIONS), where('cardId', '==', cardId)),
  )
  await deleteAll(snapshot.docs.map((item) => item.ref))
}

async function deleteBankInvoices(uid: string, bankId: string) {
  const snapshot = await getDocs(
    query(userCollection(uid, FirestoreCollections.INVOICE_TRANSACTIONS), where('bankId', '==', bankId)),
  )
  await deleteAll(snapshot.docs.map((item) => item.ref))
}

export async function deleteBank(uid: string, bankId: string) {
  await deleteEntriesAndGroups(uid, bankId)
  await deleteStatement(uid, bankId)
  await deleteBankInvoices(uid, bankId)
  await deleteDoc(bankRef(uid, bankId))
}

export async function deleteCard(uid: string, bankId: string, cardId: string, remaining: Card[]) {
  await deleteEntriesAndGroups(uid, bankId, cardId)
  await deleteInvoice(uid, cardId)
  await saveCards(uid, bankId, remaining)
}

export async function setCardLimit(uid: string, bank: Bank, card: Card, limit: number) {
  const updated = bank.cards.map((existing) => (existing.id === card.id ? { ...existing, limit } : existing))
  await saveCards(uid, bank.id, updated)
}
