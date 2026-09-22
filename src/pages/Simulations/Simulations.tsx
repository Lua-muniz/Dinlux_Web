import { useCallback, useEffect, useMemo, useState, type WheelEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal/Modal'
import { TextDialog, ConfirmDialog } from '../Finance/FinanceDialogs'
import { loadBanks, loadEntries, loadSimulations, type Bank, type Simulation, type SimulationEntry } from '../../lib/dinluxData'
import { resolveColors, colorFor as resolveColorFor } from '../../lib/entityColors'
import {
  activateSimulation,
  createEntry,
  createSimulation,
  deleteEntry,
  deleteSimulation,
  loadGroups,
  moveEntryToGroup,
  renameGroup,
  renameSimulation,
  setSimulationActive,
  updateEntryTitle,
  updateSavingsGoal,
  type SimulationGroup,
} from '../../lib/simulations'
import SimulationCanvas from './SimulationCanvas'
import { CreateEntryDialog, EditPurchaseTitleDialog, EditSavingsDialog, NodeDetailsDialog } from './EntryDialogs'
import DropdownMenu from '../../components/DropdownMenu/DropdownMenu'
import './Simulations.css'

const PLUS_ICON = 'M12 5v14M5 12h14'
const DOTS_ICON = 'M5 12h.01M12 12h.01M19 12h.01'
const CHEVRON_ICON = 'M6 9l6 6 6-6'

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function SimulationMenu({ simulation, onRename, onDelete, onToggleActive }: {
  simulation: Simulation
  onRename: () => void
  onDelete: () => void
  onToggleActive: () => void
}) {
  return (
    <DropdownMenu
      label="Opções da simulação"
      icon={DOTS_ICON}
      align="left"
      buttonClassName="sim-tab-menu-button"
      iconSize={18}
      iconStrokeWidth={2}
      items={[
        { label: 'Renomear', onSelect: onRename },
        { label: simulation.active ? 'Desativar' : 'Ativar', onSelect: onToggleActive },
        { label: 'Excluir', danger: true, onSelect: onDelete },
      ]}
    />
  )
}

export default function Simulations() {
  const { user } = useAuth()
  const uid = user?.uid

  const [simulations, setSimulations] = useState<Simulation[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [groups, setGroups] = useState<SimulationGroup[]>([])
  const [entries, setEntries] = useState<SimulationEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [activeCreditPurchases, setActiveCreditPurchases] = useState<SimulationEntry[]>([])
  const [legendCollapsed, setLegendCollapsed] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Simulation | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Simulation | null>(null)
  const [activateTarget, setActivateTarget] = useState<{ simulation: Simulation; entries: SimulationEntry[] } | null>(null)

  const [addChoiceOpen, setAddChoiceOpen] = useState(false)
  const [entryFormType, setEntryFormType] = useState<'PURCHASE' | 'SAVINGS' | null>(null)
  const [detailsEntry, setDetailsEntry] = useState<SimulationEntry | null>(null)
  const [editEntry, setEditEntry] = useState<SimulationEntry | null>(null)
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<SimulationEntry | null>(null)
  const [renameGroupTarget, setRenameGroupTarget] = useState<SimulationGroup | null>(null)

  const reloadSimulations = useCallback(async () => {
    if (!uid) return
    try {
      const loaded = await loadSimulations(uid)
      setSimulations(loaded)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [uid])

  const reloadBanks = useCallback(async () => {
    if (!uid) return
    setBanks(await loadBanks(uid))
  }, [uid])

  const reloadActiveCreditPurchases = useCallback(async () => {
    if (!uid) return
    const active = (await loadSimulations(uid)).filter((simulation) => simulation.active)
    const all = await Promise.all(active.map((simulation) => loadEntries(uid, simulation.id)))
    setActiveCreditPurchases(
      all.flat().filter((entry) => entry.type === 'PURCHASE' && entry.paymentMethod === 'CREDIT'),
    )
  }, [uid])

  useEffect(() => {
    reloadSimulations()
    reloadBanks()
    reloadActiveCreditPurchases()
  }, [reloadSimulations, reloadBanks, reloadActiveCreditPurchases])

  useEffect(() => {
    if (simulations.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !simulations.some((simulation) => simulation.id === selectedId)) {
      setSelectedId(simulations[0].id)
    }
  }, [simulations, selectedId])

  const selected = simulations.find((simulation) => simulation.id === selectedId) ?? null

  const reloadCanvas = useCallback(async () => {
    if (!uid || !selectedId) {
      setGroups([])
      setEntries([])
      return
    }
    const [loadedGroups, loadedEntries] = await Promise.all([loadGroups(uid, selectedId), loadEntries(uid, selectedId)])
    setGroups(loadedGroups)
    setEntries(loadedEntries)
  }, [uid, selectedId])

  useEffect(() => {
    reloadCanvas()
  }, [reloadCanvas])

  const bankName = useCallback((bankId: string) => banks.find((bank) => bank.id === bankId)?.name ?? 'Banco excluído', [banks])

  const canvasColors = useMemo(
    () => resolveColors(groups.map((group) => group.cardId || group.bankId)),
    [groups],
  )
  const canvasColorFor = useCallback((id: string) => resolveColorFor(canvasColors, id), [canvasColors])

  const legendRows = useMemo(
    () => banks.flatMap((bank) => [
      { id: bank.id, label: `${bank.name} — Débito` },
      ...bank.cards.map((card) => ({ id: card.id, label: `${bank.name} — ${card.label}` })),
    ]),
    [banks],
  )
  const legendColors = useMemo(() => resolveColors(legendRows.map((row) => row.id)), [legendRows])

  const activeSimulations = useMemo(() => simulations.filter((simulation) => simulation.active), [simulations])
  const inactiveSimulations = useMemo(() => simulations.filter((simulation) => !simulation.active), [simulations])

  if (status === 'loading') return <p className="home-status">Carregando…</p>
  if (status === 'error') return <p className="home-status">Não foi possível carregar os dados.</p>
  if (!uid) return null

  const currentUid = uid

  async function handleCreateSimulation(title: string) {
    await createSimulation(currentUid, title, false)
    await reloadSimulations()
  }

  function handleRenameSimulation(simulation: Simulation) {
    setRenameTarget(simulation)
  }

  function handleToggleActive(simulation: Simulation) {
    if (simulation.active) {
      setSimulationActive(currentUid, simulation.id, false).then(reloadSimulations)
      return
    }
    loadEntries(currentUid, simulation.id).then((simulationEntries) => {
      setActivateTarget({ simulation, entries: simulationEntries })
    })
  }

  function handleTabsWheel(event: WheelEvent<HTMLDivElement>) {
    const element = event.currentTarget
    if (element.scrollWidth <= element.clientWidth) return
    event.preventDefault()
    element.scrollLeft += event.deltaY
  }

  function renderTab(simulation: Simulation) {
    return (
      <div key={simulation.id} className={`sim-tab ${selectedId === simulation.id ? 'active' : ''} ${simulation.active ? '' : 'inactive'}`}>
        <button type="button" className="sim-tab-button" onClick={() => setSelectedId(simulation.id)}>
          {simulation.title}
        </button>
        <SimulationMenu
          simulation={simulation}
          onRename={() => handleRenameSimulation(simulation)}
          onDelete={() => setDeleteTarget(simulation)}
          onToggleActive={() => handleToggleActive(simulation)}
        />
      </div>
    )
  }

  return (
    <div className="sim-page">
      <div className="sim-top">
        <div className="sim-tabs" onWheel={handleTabsWheel}>
          {activeSimulations.map(renderTab)}
          {activeSimulations.length > 0 && inactiveSimulations.length > 0 && <div className="sim-tabs-divider" aria-hidden="true" />}
          {inactiveSimulations.map(renderTab)}
        </div>
        <button type="button" className="auth-form-submit sim-create-btn" onClick={() => setCreateOpen(true)}>
          Criar Simulação
        </button>
      </div>

      {simulations.length === 0 && <p className="home-status">Nenhuma simulação criada ainda.</p>}

      {selected && (
        <div className="sim-canvas-area">
          <div className="sim-legend">
            <div className="sim-legend-header">
              <strong>Bancos e cartões</strong>
              <button
                type="button"
                className={`sim-legend-toggle ${legendCollapsed ? 'collapsed' : ''}`}
                aria-label={legendCollapsed ? 'Expandir lista de bancos e cartões' : 'Minimizar lista de bancos e cartões'}
                onClick={() => setLegendCollapsed((current) => !current)}
              >
                <Icon d={CHEVRON_ICON} />
              </button>
            </div>
            {!legendCollapsed &&
              (legendRows.length === 0 ? (
                <span className="sim-legend-empty">Nenhum banco cadastrado.</span>
              ) : (
                legendRows.map((row) => (
                  <span key={row.id} className="sim-legend-item">
                    <i style={{ background: resolveColorFor(legendColors, row.id) }} />
                    {row.label}
                  </span>
                ))
              ))}
          </div>

          {entries.length === 0 && <p className="sim-canvas-empty">Nenhum lançamento criado ainda nesta simulação.</p>}

          <SimulationCanvas
            groups={groups}
            entries={entries}
            colorFor={canvasColorFor}
            onNodeClick={(entry) => setDetailsEntry(entry)}
            onGroupClick={(group) => setRenameGroupTarget(group)}
            onNodeMoved={(entry, group) => {
              moveEntryToGroup(uid, entry, group)
                .then(reloadCanvas)
                .catch(() => {})
            }}
          />

          <button type="button" className="sim-add-node-btn" aria-label="Criar nó" onClick={() => setAddChoiceOpen(true)}>
            <Icon d={PLUS_ICON} />
          </button>
        </div>
      )}

      {createOpen && (
        <TextDialog
          title="Nova simulação"
          label="Nome"
          initial=""
          onClose={() => setCreateOpen(false)}
          onSave={(title) => handleCreateSimulation(title)}
        />
      )}

      {renameTarget && (
        <TextDialog
          title="Renomear simulação"
          label="Nome"
          initial={renameTarget.title}
          onClose={() => setRenameTarget(null)}
          onSave={async (title) => {
            await renameSimulation(uid, renameTarget.id, title)
            await reloadSimulations()
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Excluir simulação"
          message={`Tem certeza que deseja excluir "${deleteTarget.title}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteSimulation(uid, deleteTarget.id)
            await reloadSimulations()
          }}
        />
      )}

      {activateTarget && (
        <ConfirmDialog
          title="Ativar simulação"
          message={
            activateTarget.entries.length === 0
              ? `Essa simulação ainda não tem lançamentos. Ativar "${activateTarget.simulation.title}"?`
              : `${activateTarget.entries.length} lançamento(s) terão a data recalculada a partir de hoje, mantendo parcelas, meses e juros. Ativar "${activateTarget.simulation.title}"?`
          }
          confirmLabel="Ativar"
          onClose={() => setActivateTarget(null)}
          onConfirm={async () => {
            await activateSimulation(uid, activateTarget.simulation.id, activateTarget.entries, banks)
            await reloadSimulations()
            await reloadCanvas()
          }}
        />
      )}

      {addChoiceOpen && (
        <Modal title="Novo lançamento" onClose={() => setAddChoiceOpen(false)}>
          <div className="auth-form">
            <button type="button" className="auth-form-submit" onClick={() => { setAddChoiceOpen(false); setEntryFormType('PURCHASE') }}>
              Compra
            </button>
            <button type="button" className="auth-form-submit" onClick={() => { setAddChoiceOpen(false); setEntryFormType('SAVINGS') }}>
              Economia
            </button>
          </div>
        </Modal>
      )}

      {selected && entryFormType && (
        banks.length === 0 ? (
          <Modal title="Nenhum banco cadastrado" onClose={() => setEntryFormType(null)}>
            <p className="settings-current">Cadastre um banco em Finanças antes de criar um lançamento.</p>
          </Modal>
        ) : (
          <CreateEntryDialog
            simulationId={selected.id}
            type={entryFormType}
            banks={banks}
            activeCreditPurchases={activeCreditPurchases}
            onClose={() => setEntryFormType(null)}
            onSave={async (entry) => {
              await createEntry(uid, entry)
              setEntryFormType(null)
              await reloadCanvas()
              await reloadActiveCreditPurchases()
            }}
          />
        )
      )}

      {detailsEntry && (
        <NodeDetailsDialog
          entry={detailsEntry}
          bankName={bankName(detailsEntry.bankId)}
          simulationActive={selected?.active ?? false}
          onClose={() => setDetailsEntry(null)}
          onEdit={() => {
            setEditEntry(detailsEntry)
            setDetailsEntry(null)
          }}
          onDelete={() => {
            setDeleteEntryTarget(detailsEntry)
            setDetailsEntry(null)
          }}
        />
      )}

      {editEntry && editEntry.type === 'PURCHASE' && (
        <EditPurchaseTitleDialog
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={async (title) => {
            await updateEntryTitle(uid, editEntry.id, title)
            await reloadCanvas()
          }}
        />
      )}

      {editEntry && editEntry.type === 'SAVINGS' && (
        <EditSavingsDialog
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={async (title, target, start, end) => {
            await updateSavingsGoal(uid, editEntry.id, target, start, end)
            if (title !== editEntry.title) await updateEntryTitle(uid, editEntry.id, title)
            await reloadCanvas()
          }}
        />
      )}

      {deleteEntryTarget && (
        <ConfirmDialog
          title="Excluir lançamento"
          message={`Tem certeza que deseja excluir "${deleteEntryTarget.title}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onClose={() => setDeleteEntryTarget(null)}
          onConfirm={async () => {
            await deleteEntry(uid, deleteEntryTarget)
            await reloadCanvas()
          }}
        />
      )}

      {renameGroupTarget && (
        <TextDialog
          title="Renomear Grupo"
          label="Nome"
          initial={renameGroupTarget.name}
          onClose={() => setRenameGroupTarget(null)}
          onSave={async (name) => {
            await renameGroup(uid, renameGroupTarget.id, name)
            await reloadCanvas()
          }}
        />
      )}
    </div>
  )
}
