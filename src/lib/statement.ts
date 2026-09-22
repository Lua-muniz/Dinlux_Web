import { collection, doc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'
import { deleteStatement } from './finance'

const BATCH_LIMIT = 400

export type ParsedTransaction = {
  date: number
  description: string
  amount: number
  credit: boolean
}

export type ParseResult =
  | { ok: true; transactions: ParsedTransaction[]; bankCode: string | null }
  | { ok: false; error: string }

const DATE_KEYS = ['data', 'date', 'dt']
const VALUE_KEYS = ['valor', 'amount', 'value', 'vl']
const DESC_KEYS = ['descricao', 'description', 'desc', 'historico']
const TYPE_KEYS = ['tipo', 'type', 'natureza', 'c/d', 'd/c']
const CREDIT_VALUES = ['c', 'credito', 'entrada']
const DEBIT_VALUES = ['d', 'debito', 'saida']

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function parseDate(raw: string): number | null {
  const text = raw.trim()
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brazilian) return new Date(+brazilian[3], +brazilian[2] - 1, +brazilian[1]).getTime()

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime()

  const dashed = text.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dashed) return new Date(+dashed[3], +dashed[2] - 1, +dashed[1]).getTime()

  return null
}

function parseAmount(raw: string): number | null {
  let text = raw.trim().replace(/r\$/gi, '').replace(/\s/g, '')
  if (!text) return null

  const negative = /^\(.*\)$/.test(text)
  text = text.replace(/[()]/g, '')
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')

  const value = Number(text)
  if (!Number.isFinite(value)) return null
  return negative ? -Math.abs(value) : value
}

function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === separator && !inQuotes) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells.map((cell) => cell.trim().replace(/^"|"$/g, ''))
}

export function parseCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { ok: false, error: 'Arquivo vazio.' }

  const semicolons = (text.match(/;/g) ?? []).length
  const commas = (text.match(/,/g) ?? []).length
  const separator = semicolons >= commas ? ';' : ','

  let headerIndex = -1
  let columns: { date?: number; value?: number; description?: number; type?: number } = {}

  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], separator).map(normalize)
    const found: typeof columns = {}
    cells.forEach((cell, index) => {
      if (found.date === undefined && DATE_KEYS.includes(cell)) found.date = index
      else if (found.value === undefined && VALUE_KEYS.includes(cell)) found.value = index
      else if (found.description === undefined && DESC_KEYS.includes(cell)) found.description = index
      else if (found.type === undefined && TYPE_KEYS.includes(cell)) found.type = index
    })
    if (found.date !== undefined && found.value !== undefined) {
      headerIndex = i
      columns = found
      break
    }
  }

  if (headerIndex === -1) {
    return { ok: false, error: 'Não foi possível reconhecer as colunas do arquivo CSV.' }
  }

  const transactions: ParsedTransaction[] = []
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], separator)
    const dateText = columns.date !== undefined ? cells[columns.date] : undefined
    const valueText = columns.value !== undefined ? cells[columns.value] : undefined
    if (!dateText || !valueText) continue

    const date = parseDate(dateText)
    const amount = parseAmount(valueText)
    if (date === null || amount === null) continue

    const description = (columns.description !== undefined ? cells[columns.description] : '') || 'Lançamento'
    let credit = amount >= 0
    if (columns.type !== undefined) {
      const typeText = normalize(cells[columns.type] ?? '')
      if (CREDIT_VALUES.includes(typeText)) credit = true
      else if (DEBIT_VALUES.includes(typeText)) credit = false
    }

    transactions.push({ date, description, amount: Math.abs(amount), credit })
  }

  return { ok: true, transactions, bankCode: null }
}

export function parseOfx(text: string): ParseResult {
  const bankIdMatch = text.match(/<BANKID>([^\r\n<]*)/i)
  const bankCode = bankIdMatch ? bankIdMatch[1].trim() : null

  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []
  if (blocks.length === 0) return { ok: false, error: 'Não foi possível encontrar lançamentos no arquivo OFX.' }

  const transactions: ParsedTransaction[] = []
  for (const block of blocks) {
    const tagValue = (tag: string) => {
      const match = block.match(new RegExp(`<${tag}>([^\\r\\n<]*)`, 'i'))
      return match ? match[1].trim() : null
    }

    const dtposted = tagValue('DTPOSTED')
    const trnamt = tagValue('TRNAMT')
    if (!dtposted || !trnamt) continue

    const digits = dtposted.slice(0, 8)
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6, 8))
    if (!year || !month || !day) continue

    const amount = Number(trnamt.replace(',', '.'))
    if (!Number.isFinite(amount)) continue

    const description = tagValue('MEMO') || tagValue('NAME') || tagValue('TRNTYPE') || 'Lançamento'

    transactions.push({
      date: new Date(year, month - 1, day).getTime(),
      description,
      amount: Math.abs(amount),
      credit: amount >= 0,
    })
  }

  if (transactions.length === 0) return { ok: false, error: 'Não foi possível ler os lançamentos do arquivo OFX.' }

  return { ok: true, transactions, bankCode }
}

export function parseStatementFile(fileName: string, text: string): ParseResult {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.ofx')) return parseOfx(text)
  if (lower.endsWith('.csv')) return parseCsv(text)
  return { ok: false, error: 'Formato de arquivo não suportado. Selecione um arquivo .csv ou .ofx.' }
}

export async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}

function dedupeKey(transaction: ParsedTransaction): string {
  return `${transaction.date}|${transaction.description.trim().toLowerCase()}|${Math.round(transaction.amount * 100)}|${transaction.credit}`
}

function dedupeTransactions(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>()
  const result: ParsedTransaction[] = []
  for (const transaction of transactions) {
    const key = dedupeKey(transaction)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(transaction)
  }
  return result
}

export async function saveStatement(uid: string, bankId: string, transactions: ParsedTransaction[]) {
  await deleteStatement(uid, bankId)
  const deduped = dedupeTransactions(transactions)
  const col = collection(db, FirestoreCollections.USERS, uid, FirestoreCollections.STATEMENT_TRANSACTIONS)
  for (let start = 0; start < deduped.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    deduped.slice(start, start + BATCH_LIMIT).forEach((transaction) => {
      batch.set(doc(col), {
        bankId,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        credit: transaction.credit,
        importedAt: Date.now(),
      })
    })
    await batch.commit()
  }
}
