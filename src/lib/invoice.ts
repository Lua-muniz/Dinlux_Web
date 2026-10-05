import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'
import { deleteInvoice } from './finance'
import type { InvoiceTransaction } from './invoiceParser'

const BATCH_LIMIT = 400

export async function saveInvoice(uid: string, bankId: string, cardId: string, transactions: InvoiceTransaction[]) {
  await deleteInvoice(uid, cardId)
  const col = collection(db, FirestoreCollections.USERS, uid, FirestoreCollections.INVOICE_TRANSACTIONS)
  const importedAt = Date.now()
  for (let start = 0; start < transactions.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    transactions.slice(start, start + BATCH_LIMIT).forEach((transaction) => {
      batch.set(doc(col), {
        bankId,
        cardId,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        credit: transaction.credit,
        importedAt,
      })
    })
    await batch.commit()
  }
}
