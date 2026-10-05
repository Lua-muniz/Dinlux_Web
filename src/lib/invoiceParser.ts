export type InvoiceTransaction = {
  date: number
  description: string
  amount: number
  credit: boolean
}

export type InvoiceParseResult =
  | { ok: true; transactions: InvoiceTransaction[]; total: number | null; status: string | null }
  | { ok: false; error: string }

type Columns = { date: number; value: number; description: number; installment: number; type: number }
type Row = { date: number; description: string; value: number; type: string }

const MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

const VALUE_NAMES = ['valor', 'amount', 'value', 'montante', 'quantia', 'vlr']
const EXCLUDED_VALUE_NAMES = ['cota', 'saldo', 'limite', 'iof', 'juros', 'multa', 'encargo', 'taxa']
const DESCRIPTION_NAMES = [
  'descricao', 'historico', 'lancamento', 'estabelecimento', 'establishment', 'title',
  'titulo', 'description', 'memo', 'detalhe', 'merchant', 'loja',
]
const TYPE_NAMES = ['tipo', 'type', 'natureza']

const INSTALLMENT = /^\d{1,3}\s*(\/|de)\s*\d{1,3}$/i
const ISO_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})/
const FULL_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/
const SHORT_YEAR_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})(?!\d)/
const NO_YEAR_DATE = /^(\d{1,2})[/.-](\d{1,2})(?![\d/.-])/
const WRITTEN_MONTH_DATE = /^(\d{1,2})[\s/-]*(?:de\s+)?([a-z]{3,9})\.?(?:[\s/-]*(?:de\s+)?(\d{4}))?$/
const ISSUE_DATE = /^data(?:\s+de\s+\w+)?\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
const DUE_DATE = /vencimento\s*:?\s*;?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
const STATUS = /situa.{1,3}o\s+da\s+fatura\s*:\s*([^;,]+)/i
const NUMBER_AT_END = /(-?\d[\d.,]*)\s*$/
const SUMMARY_LINE =
  /^(saldo\s+(da\s+fatura\s+)?anterior|saldo\s+fatura\s+anterior|total\s+(da\s+fatura|de\s+compras|a\s+pagar|geral|fatura|em\s+real|do\s+periodo|desta\s+fatura)|total$|subtotal|pagamento\s+minimo|valor\s+total|limite\s+(total|disponivel|utilizado))/
const PAYMENT_OR_CREDIT =
  /^(pagamento\s+(recebido|efetuado|on-?line|de\s+fatura|fatura|em\b|via\b|cartao)|pag\.?\s+(boleto|fatura|debito|conta)\b|pagto\.?\s+(fatura|recebido|boleto)|pgto\.?\s+(fatura|recebido|boleto)|estorno\b|credito\s+(de|em|fatura)\b|devolucao\b)/

const OFX_DEBIT_TYPES = ['DEBIT', 'POS', 'ATM', 'CASH', 'FEE', 'SRVCHG']
const OFX_CREDIT_TYPES = ['CREDIT', 'PAYMENT', 'DEP', 'DIRECTDEP', 'DIV']

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function looksLikeOfx(text: string): boolean {
  return /<OFX|OFXHEADER/i.test(text)
}

function utcDate(year: number, month: number, day: number): number | null {
  const time = Date.UTC(year, month - 1, day)
  const date = new Date(time)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return time
}

function inferYear(day: number, month: number, reference: number): number | null {
  const referenceYear = new Date(reference).getUTCFullYear()
  for (let offset = 0; offset <= 2; offset++) {
    const candidate = utcDate(referenceYear - offset, month, day)
    if (candidate !== null && candidate <= reference) return candidate
  }
  return null
}

function parseDate(raw: string, reference: number): number | null {
  const text = normalize(raw)
  if (!text) return null

  let match = ISO_DATE.exec(text)
  if (match) return utcDate(+match[1], +match[2], +match[3])

  match = FULL_DATE.exec(text)
  if (match) return utcDate(+match[3], +match[2], +match[1]) ?? utcDate(+match[3], +match[1], +match[2])

  match = SHORT_YEAR_DATE.exec(text)
  if (match) return utcDate(2000 + +match[3], +match[2], +match[1])

  match = NO_YEAR_DATE.exec(text)
  if (match) return inferYear(+match[1], +match[2], reference)

  match = WRITTEN_MONTH_DATE.exec(text)
  if (match) {
    const month = MONTHS[match[2].slice(0, 3)]
    if (!month) return null
    return match[3] ? utcDate(+match[3], month, +match[1]) : inferYear(+match[1], month, reference)
  }
  return null
}

function parseFullDate(text: string): number | null {
  const [day, month, year] = text.split('/').map(Number)
  return utcDate(year, month, day)
}

export function parseMoney(raw: string): number | null {
  let text = raw.trim().replace(/ /g, ' ').replace(/−/g, '-')
  if (!text) return null

  let negative = false
  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true
    text = text.slice(1, -1).trim()
  }
  text = text.replace(/R\$|US\$|USD|BRL/gi, '').trim()

  const suffix = /\s*(CR|DB|C|D)$/i.exec(text)
  if (suffix && suffix.index > 0) {
    const kind = suffix[1].toUpperCase()
    if (kind === 'CR' || kind === 'C') negative = true
    text = text.slice(0, suffix.index).trim()
  }
  if (text.startsWith('-')) {
    negative = true
    text = text.slice(1)
  } else if (text.startsWith('+')) {
    text = text.slice(1)
  }
  if (text.endsWith('-')) {
    negative = true
    text = text.slice(0, -1)
  }
  text = text.replace(/\s/g, '')
  if (!/\d/.test(text) || !/^[\d.,]+$/.test(text)) return null

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  let normalized: string
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (lastComma >= 0) {
    normalized = (text.match(/,/g) ?? []).length > 1 ? text.replace(/,/g, '') : text.replace(',', '.')
  } else if (lastDot >= 0) {
    normalized = (text.match(/\./g) ?? []).length > 1 || text.length - lastDot - 1 === 3 ? text.replace(/\./g, '') : text
  } else {
    normalized = text
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return negative ? -Math.abs(value) : value
}

function chooseSeparator(line: string): string {
  let best = ';'
  let bestCount = 0
  for (const separator of [';', ',', '\t', '|']) {
    const count = line.split(separator).length - 1
    if (count > bestCount) {
      best = separator
      bestCount = count
    }
  }
  return best
}

function splitLine(line: string, separator: string): string[] {
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
  return cells.map((cell) => cell.trim())
}

function isDateColumn(name: string): boolean {
  return name.startsWith('data') || name.startsWith('date') || name === 'dt' || name.startsWith('dt ')
}

function isRealCurrency(name: string): boolean {
  return name.includes('r$') || name.includes('brl') || name.includes('reais')
}

function isForeignCurrency(name: string): boolean {
  return name.includes('us$') || name.includes('usd') || name.includes('dolar') || name.includes('eur')
}

function chooseValueColumn(header: string[], used: Set<number>): number {
  const candidates = header
    .map((name, index) => ({ name, index }))
    .filter(
      ({ name, index }) =>
        !used.has(index) &&
        VALUE_NAMES.some((term) => name.includes(term)) &&
        !EXCLUDED_VALUE_NAMES.some((term) => name.includes(term)),
    )
  const chosen =
    candidates.find(({ name }) => isRealCurrency(name)) ??
    candidates.find(({ name }) => !isForeignCurrency(name)) ??
    candidates[0]
  return chosen ? chosen.index : -1
}

function chooseDescriptionColumn(header: string[], used: Set<number>): number {
  for (const term of DESCRIPTION_NAMES) {
    const index = header.findIndex((name, position) => !used.has(position) && name.includes(term))
    if (index >= 0) return index
  }
  return -1
}

function recognizeColumns(header: string[], requireDescription: boolean): Columns | null {
  const used = new Set<number>()
  const date = header.findIndex(isDateColumn)
  if (date < 0) return null
  used.add(date)

  const value = chooseValueColumn(header, used)
  if (value < 0) return null
  used.add(value)

  const description = chooseDescriptionColumn(header, used)
  if (description < 0 && requireDescription) return null
  if (description >= 0) used.add(description)

  const installment = header.findIndex(
    (name, index) => !used.has(index) && (name.includes('parcela') || name.includes('installment')),
  )
  const type = header.findIndex((name, index) => !used.has(index) && TYPE_NAMES.includes(name))
  return { date, value, description, installment, type }
}

function locateHeader(lines: string[]): { index: number; separator: string; columns: Columns } | null {
  for (const requireDescription of [true, false]) {
    for (let index = 0; index < lines.length; index++) {
      const separator = chooseSeparator(lines[index])
      const header = splitLine(lines[index], separator).map(normalize)
      const columns = recognizeColumns(header, requireDescription)
      if (columns) return { index, separator, columns }
    }
  }
  return null
}

function isSummaryLine(description: string): boolean {
  return SUMMARY_LINE.test(normalize(description))
}

function parseRow(line: string, separator: string, columns: Columns, reference: number): Row | null {
  const cells = splitLine(line, separator)
  if (columns.date >= cells.length || columns.value >= cells.length) return null

  const date = parseDate(cells[columns.date], reference)
  if (date === null) return null
  const value = parseMoney(cells[columns.value])
  if (value === null || value === 0) return null

  let description = (columns.description >= 0 ? cells[columns.description] : '') || 'Lançamento'
  if (isSummaryLine(description)) return null

  const installment = columns.installment >= 0 ? (cells[columns.installment] ?? '').trim() : ''
  if (INSTALLMENT.test(installment) && installment !== '1/1' && !description.endsWith(installment)) {
    description = `${description} (${installment})`
  }
  return { date, description, value, type: columns.type >= 0 ? (cells[columns.type] ?? '') : '' }
}

function isConventionInverted(rows: Row[]): boolean {
  let normalVotes = 0
  let invertedVotes = 0
  for (const row of rows) {
    const payment = PAYMENT_OR_CREDIT.test(normalize(row.description)) || PAYMENT_OR_CREDIT.test(normalize(row.type))
    if (!payment) continue
    if (row.value < 0) normalVotes++
    else invertedVotes++
  }
  if (normalVotes !== invertedVotes) return invertedVotes > normalVotes
  return rows.length >= 2 && rows.every((row) => row.value <= 0)
}

function readReferenceDate(lines: string[]): number | null {
  for (const line of lines) {
    const match = ISSUE_DATE.exec(line)
    if (match) return parseFullDate(match[1])
  }
  for (const line of lines) {
    const match = DUE_DATE.exec(line)
    if (match) return parseFullDate(match[1])
  }
  return null
}

function readStatus(lines: string[]): string | null {
  for (const line of lines) {
    const match = STATUS.exec(line)
    if (match && match[1].trim()) return match[1].trim()
  }
  return null
}

function readTotal(lines: string[], separator: string): number | null {
  for (const line of lines) {
    const cells = splitLine(line, separator)
    const label = normalize(cells.find((cell) => cell !== '') ?? '')
    const isTotal =
      label.startsWith('total da fatura') ||
      label.startsWith('total a pagar') ||
      label.startsWith('valor total da fatura') ||
      label.startsWith('total geral')
    if (!isTotal) continue

    const numbers = cells.map(parseMoney).filter((value): value is number => value !== null)
    const fallback = NUMBER_AT_END.exec(line)
    const number = numbers.length > 0 ? numbers[numbers.length - 1] : fallback ? parseMoney(fallback[1]) : null
    if (number !== null) return Math.abs(number)
  }
  return null
}

function parseCsvInvoice(text: string, today: Date): InvoiceParseResult {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const header = locateHeader(lines)
  if (!header) {
    return {
      ok: false,
      error:
        'Não foi possível reconhecer as colunas dessa fatura (data/valor). O layout desse banco ainda não é suportado — se o banco permitir, exporte em OFX.',
    }
  }

  const reference = readReferenceDate(lines) ?? Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const rows = lines
    .slice(header.index + 1)
    .map((line) => parseRow(line, header.separator, header.columns, reference))
    .filter((row): row is Row => row !== null)

  const inverted = isConventionInverted(rows)
  const transactions = rows.map((row) => {
    const amount = inverted ? row.value : -row.value
    return { date: row.date, description: row.description, amount, credit: amount > 0 }
  })
  return {
    ok: true,
    transactions,
    total: readTotal(lines, header.separator),
    status: readStatus(lines),
  }
}

function parseOfxInvoice(text: string): InvoiceParseResult {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []
  const transactions: InvoiceTransaction[] = []

  for (const block of blocks) {
    const tag = (name: string) => new RegExp(`<${name}>([^\\r\\n<]*)`, 'i').exec(block)?.[1].trim() ?? null

    const posted = tag('DTPOSTED') ?? tag('DTUSER')
    const rawAmount = tag('TRNAMT')
    if (!posted || !rawAmount) continue

    const dateMatch = /^(\d{4})(\d{2})(\d{2})/.exec(posted)
    const date = dateMatch ? utcDate(+dateMatch[1], +dateMatch[2], +dateMatch[3]) : null
    const raw = parseMoney(rawAmount)
    if (date === null || raw === null) continue

    const type = (tag('TRNTYPE') ?? '').toUpperCase()
    const amount = OFX_DEBIT_TYPES.includes(type) ? -Math.abs(raw) : OFX_CREDIT_TYPES.includes(type) ? Math.abs(raw) : raw
    const description = tag('MEMO') || tag('NAME') || tag('TRNTYPE') || 'Lançamento'
    if (amount === 0 || isSummaryLine(description)) continue

    transactions.push({ date, description, amount, credit: amount > 0 })
  }

  const balance = /<LEDGERBAL>[\s\S]*?<BALAMT>\s*([^<\r\n]+)/i.exec(text)?.[1]
  const total = balance ? parseMoney(balance) : null
  return { ok: true, transactions, total: total === null ? null : Math.abs(total), status: null }
}

export function parseInvoice(text: string, today: Date = new Date()): InvoiceParseResult {
  const content = text.replace(/^﻿/, '')
  return looksLikeOfx(content) ? parseOfxInvoice(content) : parseCsvInvoice(content, today)
}
