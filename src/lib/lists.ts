import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import type { DocumentReference } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'

const BATCH_LIMIT = 400

function userCollection(uid: string, name: string) {
  return collection(db, FirestoreCollections.USERS, uid, name)
}

function listRef(uid: string, listId: string) {
  return doc(db, FirestoreCollections.USERS, uid, FirestoreCollections.LISTS, listId)
}

function itemRef(uid: string, itemId: string) {
  return doc(db, FirestoreCollections.USERS, uid, FirestoreCollections.LIST_ITEMS, itemId)
}

async function deleteAll(refs: DocumentReference[]) {
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    refs.slice(start, start + BATCH_LIMIT).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

export async function createList(uid: string, title: string) {
  await addDoc(userCollection(uid, FirestoreCollections.LISTS), { title, createdAt: Date.now() })
}

export async function renameList(uid: string, listId: string, title: string) {
  await updateDoc(listRef(uid, listId), { title })
}

export async function deleteList(uid: string, listId: string) {
  const snapshot = await getDocs(
    query(userCollection(uid, FirestoreCollections.LIST_ITEMS), where('listId', '==', listId)),
  )
  await deleteAll(snapshot.docs.map((item) => item.ref))
  await deleteDoc(listRef(uid, listId))
}

export async function addItem(
  uid: string,
  listId: string,
  name: string,
  quantity: number | null,
  price: number | null,
) {
  await addDoc(userCollection(uid, FirestoreCollections.LIST_ITEMS), {
    listId,
    name,
    quantity,
    price,
    done: false,
    createdAt: Date.now(),
  })
}

export async function updateItem(
  uid: string,
  itemId: string,
  name: string,
  quantity: number | null,
  price: number | null,
) {
  await updateDoc(itemRef(uid, itemId), { name, quantity, price })
}

export async function setItemDone(uid: string, itemId: string, done: boolean) {
  await updateDoc(itemRef(uid, itemId), { done })
}

export async function deleteItem(uid: string, itemId: string) {
  await deleteDoc(itemRef(uid, itemId))
}
