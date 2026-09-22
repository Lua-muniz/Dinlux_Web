import { addDoc, collection, doc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'
import type { Bank, SimulationEntry } from './dinluxData'
import { monthlySavingsAmount } from './simulationCalc'

export const MAX_NODES_PER_GROUP = 6

export type SimulationGroup = {
  id: string
  simulationId: string
  name: string
  order: number
  bankId: string
  bankName: string
  cardId: string
  cardLabel: string
  entryType: 'PURCHASE' | 'SAVINGS'
  paymentMethod: 'DEBIT' | 'CREDIT'
  nodeCount: number
}

function userCollection(uid: string, name: string) {
  return collection(db, FirestoreCollections.USERS, uid, name)
}

function simulationsRef(uid: string) {
  return userCollection(uid, FirestoreCollections.SIMULATIONS)
}

function groupsRef(uid: string) {
  return userCollection(uid, FirestoreCollections.SIMULATION_GROUPS)
}

function entriesRef(uid: string) {
  return userCollection(uid, FirestoreCollections.SIMULATION_ENTRIES)
}

export async function createSimulation(uid: string, title: string, active: boolean) {
  await addDoc(simulationsRef(uid), { title, active, createdAt: Date.now() })
}

export async function renameSimulation(uid: string, id: string, title: string) {
  await updateDoc(doc(simulationsRef(uid), id), { title })
}

export async function setSimulationActive(uid: string, id: string, active: boolean) {
  await updateDoc(doc(simulationsRef(uid), id), { active })
}

export async function activateSimulation(uid: string, simulationId: string, entries: SimulationEntry[], banks: Bank[]) {
  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const batch = writeBatch(db)

  for (const entry of entries) {
    const ref = doc(entriesRef(uid), entry.id)
    if (entry.type === 'SAVINGS') {
      const oldStart = new Date(entry.startDate)
      const oldEnd = new Date(entry.endDate)
      const months = Math.max(
        (oldEnd.getFullYear() * 12 + oldEnd.getMonth()) - (oldStart.getFullYear() * 12 + oldStart.getMonth()) + 1,
        1,
      )
      const newEnd = new Date(today.getFullYear(), today.getMonth() + months - 1, today.getDate())
      const newMonthly = monthlySavingsAmount(entry.targetValue, today, newEnd)
      batch.update(ref, {
        startDate: todayMidnight,
        endDate: newEnd.getTime(),
        monthlyAmount: newMonthly,
        savedAmount: 0,
        avisosArquivado: false,
        ultimoPeriodoVisto: 0,
        confirmedPeriods: [],
      })
    } else {
      const newClosingDay =
        entry.paymentMethod === 'CREDIT'
          ? (banks.find((bank) => bank.id === entry.bankId)?.cards.find((card) => card.id === entry.cardId)?.closingDay ??
              entry.cardClosingDay)
          : entry.cardClosingDay
      batch.update(ref, {
        createdAt: todayMidnight,
        cardClosingDay: newClosingDay,
        paidInstallments: 0,
        avisosArquivado: false,
        ultimoPeriodoVisto: 0,
        confirmedPeriods: [],
      })
    }
  }
  batch.update(doc(simulationsRef(uid), simulationId), { active: true })
  await batch.commit()
}

export async function deleteSimulation(uid: string, id: string) {
  const entries = await getDocs(query(entriesRef(uid), where('simulationId', '==', id)))
  const groups = await getDocs(query(groupsRef(uid), where('simulationId', '==', id)))
  const batch = writeBatch(db)
  entries.docs.forEach((item) => batch.delete(item.ref))
  groups.docs.forEach((item) => batch.delete(item.ref))
  batch.delete(doc(simulationsRef(uid), id))
  await batch.commit()
}

export async function loadGroups(uid: string, simulationId: string): Promise<SimulationGroup[]> {
  const snapshot = await getDocs(query(groupsRef(uid), where('simulationId', '==', simulationId)))
  return snapshot.docs
    .map((item) => {
      const data = item.data()
      return {
        id: item.id,
        simulationId: data.simulationId ?? '',
        name: data.name ?? '',
        order: data.order ?? 0,
        bankId: data.bankId ?? '',
        bankName: data.bankName ?? '',
        cardId: data.cardId ?? '',
        cardLabel: data.cardLabel ?? '',
        entryType: data.entryType ?? 'PURCHASE',
        paymentMethod: data.paymentMethod ?? 'DEBIT',
        nodeCount: data.nodeCount ?? 0,
      } as SimulationGroup
    })
    .sort((a, b) => a.order - b.order)
}

export type NewEntry = Omit<SimulationEntry, 'id' | 'groupId' | 'createdAt' | 'confirmedPeriods' | 'ultimoPeriodoVisto' | 'avisosArquivado'> & {
  createdAt?: number
}

export async function createEntry(uid: string, entry: NewEntry) {
  if (!uid) throw new Error('Usuário não autenticado.')
  if (!entry.simulationId) throw new Error('Simulação inválida para este lançamento.')
  if (!entry.bankId) throw new Error('Selecione um banco antes de salvar.')

  const existing = await getDocs(
    query(
      groupsRef(uid),
      where('simulationId', '==', entry.simulationId),
      where('bankId', '==', entry.bankId),
      where('cardId', '==', entry.cardId),
      where('entryType', '==', entry.type),
    ),
  )
  const groups = existing.docs.map((item) => ({ ...(item.data() as Omit<SimulationGroup, 'id'>), id: item.id }))
  const withRoom = groups.filter((group) => group.nodeCount < MAX_NODES_PER_GROUP).sort((a, b) => a.order - b.order)[0]

  const fullEntry = {
    ...entry,
    createdAt: entry.createdAt ?? Date.now(),
    confirmedPeriods: [] as number[],
    ultimoPeriodoVisto: 0,
    avisosArquivado: false,
  }

  const batch = writeBatch(db)
  const entryRef = doc(entriesRef(uid))

  if (withRoom) {
    batch.update(doc(groupsRef(uid), withRoom.id), { nodeCount: withRoom.nodeCount + 1 })
    batch.set(entryRef, { ...fullEntry, groupId: withRoom.id })
  } else {
    const all = await getDocs(query(groupsRef(uid), where('simulationId', '==', entry.simulationId)))
    const nextOrder = Math.max(0, ...all.docs.map((item) => item.data().order ?? 0)) + 1
    const groupRef = doc(groupsRef(uid))
    batch.set(groupRef, {
      simulationId: entry.simulationId,
      name: `Grupo ${nextOrder}`,
      order: nextOrder,
      bankId: entry.bankId,
      bankName: entry.bankName,
      cardId: entry.cardId,
      cardLabel: entry.cardLabel,
      entryType: entry.type,
      paymentMethod: entry.paymentMethod ?? 'DEBIT',
      nodeCount: 1,
    })
    batch.set(entryRef, { ...fullEntry, groupId: groupRef.id })
  }
  await batch.commit()
}

export async function renameGroup(uid: string, groupId: string, name: string) {
  await updateDoc(doc(groupsRef(uid), groupId), { name })
}

export async function updateEntryTitle(uid: string, entryId: string, title: string) {
  await updateDoc(doc(entriesRef(uid), entryId), { title })
}

export async function updateSavingsGoal(
  uid: string,
  entryId: string,
  target: number,
  start: number,
  end: number,
) {
  const monthlyAmount = monthlySavingsAmount(target, new Date(), new Date(end))
  await updateDoc(doc(entriesRef(uid), entryId), {
    targetValue: target,
    startDate: start,
    endDate: end,
    monthlyAmount,
  })
}

export async function deleteEntry(uid: string, entry: SimulationEntry) {
  const groupSnapshot = await getDocs(query(groupsRef(uid), where('simulationId', '==', entry.simulationId)))
  const group = groupSnapshot.docs.find((item) => item.id === entry.groupId)
  const currentCount = group?.data().nodeCount ?? 1
  const newCount = Math.max(currentCount - 1, 0)

  const batch = writeBatch(db)
  const groupRef = doc(groupsRef(uid), entry.groupId)
  if (newCount <= 0) {
    batch.delete(groupRef)
  } else {
    batch.update(groupRef, { nodeCount: newCount })
  }
  batch.delete(doc(entriesRef(uid), entry.id))
  await batch.commit()
}

export async function moveEntryToGroup(uid: string, entry: SimulationEntry, toGroup: SimulationGroup) {
  if (toGroup.nodeCount >= MAX_NODES_PER_GROUP) throw new Error('Esse Grupo já está cheio')

  const fromRef = doc(groupsRef(uid), entry.groupId)
  const fromSnapshot = await getDocs(query(groupsRef(uid), where('simulationId', '==', entry.simulationId)))
  const fromGroup = fromSnapshot.docs.find((item) => item.id === entry.groupId)
  const fromCount = fromGroup?.data().nodeCount ?? 1
  const newFromCount = Math.max(fromCount - 1, 0)

  const batch = writeBatch(db)
  if (newFromCount <= 0) {
    batch.delete(fromRef)
  } else {
    batch.update(fromRef, { nodeCount: newFromCount })
  }
  batch.update(doc(groupsRef(uid), toGroup.id), { nodeCount: toGroup.nodeCount + 1 })
  batch.update(doc(entriesRef(uid), entry.id), { groupId: toGroup.id })
  await batch.commit()
}
