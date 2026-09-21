import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'

type Raw = Record<string, any>

export type ExportedData = {
  nome: string
  email: string
  termsAcceptedAt: number | null
  bancos: Raw[]
  simulacoes: Raw[]
  lancamentos: Raw[]
  grupos: Raw[]
  extrato: Raw[]
  listas: Raw[]
  itensDeLista: Raw[]
}

async function loadSubcollection(uid: string, name: string): Promise<Raw[]> {
  const snapshot = await getDocs(collection(db, FirestoreCollections.USERS, uid, name))
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))
}

export async function loadAllUserData(uid: string, email: string): Promise<ExportedData> {
  const userDoc = (await getDoc(doc(db, FirestoreCollections.USERS, uid))).data()
  const [bancos, simulacoes, lancamentos, grupos, extrato, listas, itensDeLista] = await Promise.all([
    loadSubcollection(uid, FirestoreCollections.BANKS),
    loadSubcollection(uid, FirestoreCollections.SIMULATIONS),
    loadSubcollection(uid, FirestoreCollections.SIMULATION_ENTRIES),
    loadSubcollection(uid, FirestoreCollections.SIMULATION_GROUPS),
    loadSubcollection(uid, FirestoreCollections.STATEMENT_TRANSACTIONS),
    loadSubcollection(uid, FirestoreCollections.LISTS),
    loadSubcollection(uid, FirestoreCollections.LIST_ITEMS),
  ])
  return {
    nome: userDoc?.nome ?? '',
    email,
    termsAcceptedAt: typeof userDoc?.termsAcceptedAt === 'number' ? userDoc.termsAcceptedAt : null,
    bancos,
    simulacoes,
    lancamentos,
    grupos,
    extrato,
    listas,
    itensDeLista,
  }
}

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const dateFormat = new Intl.DateTimeFormat('pt-BR')

function formatDateTime(millis: number): string {
  return dateTimeFormat.format(new Date(millis)).replace(',', '')
}

function formatDate(millis: number): string {
  return dateFormat.format(new Date(millis))
}

function formatMoney(value: number | undefined): string {
  return `R$ ${(value ?? 0).toFixed(2).replace('.', ',')}`
}

export function buildJson(data: ExportedData): string {
  const root: Raw = {
    geradoEm: formatDateTime(Date.now()),
    nome: data.nome,
    email: data.email,
  }
  if (data.termsAcceptedAt !== null) root.termoDePrivacidadeAceitoEm = formatDateTime(data.termsAcceptedAt)

  root.bancos = data.bancos.map((bank) => ({
    id: bank.id,
    nome: bank.name ?? '',
    saldo: bank.debit ?? 0,
    cartoes: (bank.cards ?? []).map((card: Raw) => ({
      id: card.id,
      bandeira: card.label ?? '',
      limite: card.limit ?? 0,
      diaFechamento: card.closingDay ?? 0,
      diaVencimento: card.dueDay ?? 0,
      temJuros: card.hasInterest ?? false,
      taxaJurosMensal: card.interestRate ?? 0,
      usoManualForaDeSimulacao: card.usedAmount ?? 0,
    })),
  }))

  root.simulacoes = data.simulacoes.map((simulation) => ({
    id: simulation.id,
    titulo: simulation.title ?? '',
    ativa: simulation.active ?? false,
    criadaEm: formatDateTime(simulation.createdAt ?? 0),
  }))

  root.lancamentos = data.lancamentos.map((entry) => ({
    id: entry.id,
    simulacaoId: entry.simulationId ?? '',
    grupoId: entry.groupId ?? '',
    tipo: entry.type,
    titulo: entry.title ?? '',
    formaDePagamento: entry.paymentMethod ?? null,
    bancoId: entry.bankId ?? '',
    bancoNome: entry.bankName ?? '',
    cartaoId: entry.cardId ?? '',
    cartaoRotulo: entry.cardLabel ?? '',
    cartaoDiaFechamentoNaCompra: entry.cardClosingDay ?? 0,
    valorTotal: entry.totalValue ?? 0,
    parcelas: entry.installments ?? 1,
    taxaJuros: entry.interestRate ?? 0,
    valorParcela: entry.installmentValue ?? 0,
    valorTotalComJuros: entry.totalWithInterest ?? 0,
    parcelasConfirmadas: entry.paidInstallments ?? 0,
    metaEconomia: entry.targetValue ?? 0,
    inicioPeriodo: entry.startDate > 0 ? formatDateTime(entry.startDate) : null,
    fimPeriodo: entry.endDate > 0 ? formatDateTime(entry.endDate) : null,
    valorMensalEconomia: entry.monthlyAmount ?? 0,
    valorGuardado: entry.savedAmount ?? 0,
    criadoEm: formatDateTime(entry.createdAt ?? 0),
  }))

  root.grupos = data.grupos.map((group) => ({
    id: group.id,
    simulacaoId: group.simulationId ?? '',
    nome: group.name ?? '',
    ordem: group.order ?? 0,
    bancoNome: group.bankName ?? '',
    cartaoRotulo: group.cardLabel ?? '',
    tipo: group.entryType,
    formaDePagamento: group.paymentMethod,
    quantidadeDeNos: group.nodeCount ?? 0,
  }))

  root.extrato = data.extrato.map((transaction) => ({
    id: transaction.id,
    bancoId: transaction.bankId ?? '',
    data: formatDate(transaction.date ?? 0),
    descricao: transaction.description ?? '',
    valor: transaction.amount ?? 0,
    recebido: transaction.credit ?? false,
    importadoEm: formatDateTime(transaction.importedAt ?? 0),
  }))

  root.listas = data.listas.map((list) => ({
    id: list.id,
    titulo: list.title ?? '',
    criadaEm: formatDateTime(list.createdAt ?? 0),
    itens: data.itensDeLista
      .filter((item) => item.listId === list.id)
      .map((item) => ({
        id: item.id,
        nome: item.name ?? '',
        quantidade: item.quantity ?? null,
        preco: item.price ?? null,
        marcado: item.done ?? false,
      })),
  }))

  return JSON.stringify(root, null, 2)
}

function describeEntry(entry: Raw): string {
  if (entry.type === 'SAVINGS') {
    return (
      `${entry.title}, economia, meta ${formatMoney(entry.targetValue)}, ` +
      `guardado até agora ${formatMoney(entry.savedAmount)}, banco ${entry.bankName}`
    )
  }
  const credit = entry.paymentMethod === 'CREDIT'
  return (
    `${entry.title}, compra em ${credit ? 'crédito' : 'débito'}, valor total ${formatMoney(entry.totalValue)}, ` +
    `${entry.installments}x de ${formatMoney(entry.installmentValue)}, ` +
    `${entry.paidInstallments} parcelas confirmadas, banco ${entry.bankName}${credit ? `, cartão ${entry.cardLabel}` : ''}`
  )
}

export async function buildPdf(data: ExportedData): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 40
  const usableWidth = pdf.internal.pageSize.getWidth() - margin * 2
  let y = margin

  function write(text: string, size: number, bold: boolean, lineHeight: number) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    for (const line of pdf.splitTextToSize(text, usableWidth) as string[]) {
      if (y + lineHeight > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y + size)
      y += lineHeight
    }
  }

  const title = (text: string) => write(text, 18, true, 28)
  const section = (text: string) => write(text, 14, true, 22)
  const subtitle = (text: string) => write(text, 12, true, 18)
  const line = (text: string) => write(text, 11, false, 15)
  const gap = () => {
    y += 10
  }

  title('Dinlux, Meus Dados')
  line(`Relatório gerado em ${formatDateTime(Date.now())}`)
  line(`Nome: ${data.nome}`)
  line(`Email: ${data.email}`)
  if (data.termsAcceptedAt !== null) line(`Termo de Privacidade aceito em ${formatDateTime(data.termsAcceptedAt)}`)
  gap()

  section('Bancos e Cartões')
  if (data.bancos.length === 0) line('Nenhum banco cadastrado.')
  for (const bank of data.bancos) {
    subtitle(bank.name ?? '')
    line(`Saldo atual: ${formatMoney(bank.debit)}`)
    const cards: Raw[] = bank.cards ?? []
    if (cards.length === 0) line('Nenhum cartão cadastrado neste banco.')
    for (const card of cards) {
      line(
        `Cartão ${card.label}, limite ${formatMoney(card.limit)}, fechamento dia ${card.closingDay}, ` +
          `vencimento dia ${card.dueDay}, juros ${card.hasInterest ? `${card.interestRate}% ao mês` : 'sem juros'}, ` +
          `uso manual fora de simulação ${formatMoney(card.usedAmount)}`,
      )
    }
    gap()
  }

  section('Simulações')
  if (data.simulacoes.length === 0) line('Nenhuma simulação cadastrada.')
  for (const simulation of data.simulacoes) {
    line(
      `${simulation.title}, ${simulation.active ? 'ativa' : 'inativa'}, criada em ${formatDateTime(simulation.createdAt ?? 0)}`,
    )
  }
  gap()

  section('Lançamentos de Compra e Economia')
  if (data.lancamentos.length === 0) line('Nenhum lançamento cadastrado.')
  for (const entry of data.lancamentos) line(describeEntry(entry))
  gap()

  section('Extrato Importado')
  if (data.extrato.length === 0) line('Nenhum extrato importado.')
  for (const transaction of [...data.extrato].sort((a, b) => (b.date ?? 0) - (a.date ?? 0))) {
    line(
      `${formatDate(transaction.date ?? 0)}, ${transaction.description}, ` +
        `${transaction.credit ? 'recebido' : 'gasto'} ${formatMoney(Math.abs(transaction.amount ?? 0))}`,
    )
  }
  gap()

  section('Listas')
  if (data.listas.length === 0) line('Nenhuma lista cadastrada.')
  for (const list of data.listas) {
    subtitle(list.title ?? '')
    const items = data.itensDeLista.filter((item) => item.listId === list.id)
    if (items.length === 0) line('Nenhum item nesta lista.')
    for (const item of items) {
      const details: string[] = []
      if (item.quantity != null) details.push(`quantidade ${item.quantity}`)
      if (item.price != null) details.push(`preço ${formatMoney(item.price)}`)
      details.push(item.done ? 'marcado' : 'não marcado')
      line(`${item.name}, ${details.join(', ')}`)
    }
    gap()
  }

  return pdf.output('blob')
}

export function downloadFile(content: Blob | string, filename: string, mime: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportFilename(extension: string): string {
  const today = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `dinlux_meus_dados_${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}.${extension}`
}
