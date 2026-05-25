import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, X, Loader2, Pencil, ChevronLeft, ChevronRight, Repeat, Sigma } from 'lucide-react'
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from '../../hooks/useExpenses'
import { GlassCard, GlowBackground, PageHeader } from '../../components/shared'
import { formatEur } from '../../lib/utils'
import type { Expense, ExpenseCategory, ExpenseRequest } from '../../lib/api'

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'] as const

type FormState = {
  name: string
  amount: string            // raw text — may be a number "12.50" or a sum "61.51+36.48+44.01" (optional leading "=")
  date: string
  recurring: boolean
  category: ExpenseCategory
}

function emptyForm(): FormState {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return { name: '', amount: '', date: iso, recurring: false, category: 'PERSO' }
}

/** Parse a spreadsheet-style sum: "61.51+36.48+44.01", "12,50", "=5+10". Only `+` and decimal numbers allowed. */
function parseAmount(input: string): { sum: number | null; isFormula: boolean; error: string | null } {
  const trimmed = input.trim().replace(/^=/, '').trim()
  if (!trimmed) return { sum: null, isFormula: false, error: null }
  if (!/^[\d.,+\s]+$/.test(trimmed)) return { sum: null, isFormula: false, error: 'Caractères invalides' }
  const parts = trimmed.split('+').map(s => s.trim().replace(',', '.')).filter(Boolean)
  if (parts.length === 0) return { sum: null, isFormula: false, error: 'Vide' }
  let sum = 0
  for (const p of parts) {
    const n = parseFloat(p)
    if (!Number.isFinite(n) || n < 0) return { sum: null, isFormula: false, error: 'Nombre invalide' }
    sum += n
  }
  return {
    sum: Math.round(sum * 100) / 100,
    isFormula: parts.length > 1,
    error: null,
  }
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m, day: d }
}

/** A non-recurring expense applies only to its exact month; a recurring one applies to every month from its start date onwards. */
function appliesTo(expense: Expense, year: number, month: number): boolean {
  const d = parseDate(expense.date)
  if (expense.recurring) {
    return d.year < year || (d.year === year && d.month <= month)
  }
  return d.year === year && d.month === month
}

export function AccountingPage() {
  const { data: expenses, isLoading } = useExpenses()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()

  const [year, setYear] = useState(() => new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowForm(true) }
  const openEdit = (e: Expense) => {
    setEditing(e)
    setForm({
      name: e.name,
      amount: e.amountFormula ?? String(e.amount),
      date: e.date,
      recurring: e.recurring,
      category: e.category,
    })
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditing(null) }

  const matrix = useMemo(() => {
    const months: { perso: Expense[]; pro: Expense[]; totalPerso: number; totalPro: number }[] = []
    for (let m = 1; m <= 12; m++) {
      const perso: Expense[] = []
      const pro: Expense[] = []
      for (const e of expenses ?? []) {
        if (!appliesTo(e, year, m)) continue
        if (e.category === 'PERSO') perso.push(e)
        else pro.push(e)
      }
      const totalPerso = perso.reduce((s, e) => s + Number(e.amount), 0)
      const totalPro = pro.reduce((s, e) => s + Number(e.amount), 0)
      months.push({ perso, pro, totalPerso, totalPro })
    }
    return months
  }, [expenses, year])

  const annualPerso = matrix.reduce((s, c) => s + c.totalPerso, 0)
  const annualPro = matrix.reduce((s, c) => s + c.totalPro, 0)
  const annualTotal = annualPerso + annualPro

  const parsed = parseAmount(form.amount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (parsed.sum === null) return
    const data: ExpenseRequest = {
      name: form.name.trim(),
      amount: parsed.sum,
      amountFormula: parsed.isFormula ? form.amount.trim().replace(/^=/, '').trim() : null,
      date: form.date,
      recurring: form.recurring,
      category: form.category,
    }
    if (editing) {
      await updateExpense.mutateAsync({ id: editing.id, data })
    } else {
      await createExpense.mutateAsync(data)
    }
    closeForm()
  }

  return (
    <GlowBackground
      glows={[
        { color: 'bg-rose-200/15', size: 350, blur: 120, position: '-top-10 right-1/3' },
        { color: 'bg-amber-100/20', size: 280, blur: 100, position: 'bottom-5 left-1/4' },
      ]}
    >
      <PageHeader
        surtitle="Flux"
        title="Comptabilité"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 h-8 px-2 bg-white/70 rounded-[10px]">
              <button
                onClick={() => setYear(y => y - 1)}
                className="text-gray-500 hover:text-gray-900 p-0.5"
                aria-label="Année précédente"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-gray-900 px-1.5" style={{ fontSize: 12, fontWeight: 600 }}>
                {year}
              </span>
              <button
                onClick={() => setYear(y => y + 1)}
                className="text-gray-500 hover:text-gray-900 p-0.5"
                aria-label="Année suivante"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={openCreate}
              className="flex items-center gap-1.5 h-8 px-3 bg-gray-900 text-white rounded-[10px]"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              <Plus size={14} /> Nouvelle dépense
            </motion.button>
          </div>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <GlassCard>
          <p className="text-gray-400 mb-1" style={{ fontSize: 12, fontWeight: 500 }}>Perso · {year}</p>
          <p className="text-gray-900" style={{ fontSize: 24, fontWeight: 700 }}>{formatEur(annualPerso)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-gray-400 mb-1" style={{ fontSize: 12, fontWeight: 500 }}>Pro · {year}</p>
          <p className="text-gray-900" style={{ fontSize: 24, fontWeight: 700 }}>{formatEur(annualPro)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-gray-400 mb-1" style={{ fontSize: 12, fontWeight: 500 }}>Total cumulé · {year}</p>
          <p className="text-gray-900" style={{ fontSize: 24, fontWeight: 700 }}>{formatEur(annualTotal)}</p>
        </GlassCard>
      </motion.div>

      {isLoading ? (
        <div className="h-64 bg-white/60 rounded-[20px] animate-pulse" />
      ) : (
        <div className="overflow-x-auto -mx-2 px-2 pb-2">
          <div className="flex gap-3 min-w-max">
            {matrix.map((col, idx) => {
              const month = idx + 1
              const monthTotal = col.totalPerso + col.totalPro
              return (
                <div key={month} className="w-[200px] flex-shrink-0">
                  <GlassCard padding={false} className="p-3 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-gray-900" style={{ fontSize: 13, fontWeight: 700 }}>
                        {MONTH_LABELS[idx]}
                      </span>
                      <span className="text-gray-400" style={{ fontSize: 10, fontWeight: 500 }}>
                        {year}
                      </span>
                    </div>

                    <Section
                      label="Perso"
                      accent="text-indigo-600"
                      expenses={col.perso}
                      total={col.totalPerso}
                      onEdit={openEdit}
                      onDelete={id => { if (confirm('Supprimer cette dépense ?')) deleteExpense.mutate(id) }}
                    />

                    <div className="h-px bg-black/[0.06] my-2" />

                    <Section
                      label="Pro"
                      accent="text-violet-600"
                      expenses={col.pro}
                      total={col.totalPro}
                      onEdit={openEdit}
                      onDelete={id => { if (confirm('Supprimer cette dépense ?')) deleteExpense.mutate(id) }}
                    />

                    <div className="mt-2 pt-2 border-t border-black/[0.08] flex items-center justify-between">
                      <span className="text-gray-500" style={{ fontSize: 11, fontWeight: 600 }}>
                        Total
                      </span>
                      <span className="text-gray-900" style={{ fontSize: 13, fontWeight: 700 }}>
                        {formatEur(monthTotal)}
                      </span>
                    </div>
                  </GlassCard>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeForm}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <GlassCard rounded="2xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-900" style={{ fontSize: 17, fontWeight: 600 }}>
                    {editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
                  </h2>
                  <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                  <Field label="Nom">
                    <input
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Loyer, courses, abonnement…"
                      className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Montant (€)">
                      <input
                        required
                        type="text"
                        inputMode="decimal"
                        value={form.amount}
                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                        placeholder="61.51+36.48+44.01"
                        className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10 font-mono"
                      />
                      <p
                        className={`mt-1 px-1 ${parsed.error ? 'text-red-500' : 'text-gray-400'}`}
                        style={{ fontSize: 10, fontWeight: 500 }}
                      >
                        {parsed.error
                          ? parsed.error
                          : parsed.sum !== null
                            ? `= ${formatEur(parsed.sum)}${parsed.isFormula ? ' (somme)' : ''}`
                            : 'Astuce : tapez 61.51+36.48+44.01 pour additionner'}
                      </p>
                    </Field>
                    <Field label="Date">
                      <input
                        required
                        type="date"
                        value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </Field>
                  </div>

                  <Field label="Catégorie">
                    <div className="flex gap-2">
                      {(['PERSO', 'PRO'] as ExpenseCategory[]).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, category: cat }))}
                          className={`flex-1 h-8 rounded-[10px] text-[12px] font-[600] transition-colors ${
                            form.category === cat
                              ? 'bg-gray-900 text-white'
                              : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08]'
                          }`}
                        >
                          {cat === 'PERSO' ? 'Perso' : 'Pro'}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <label className="flex items-center justify-between bg-black/[0.03] rounded-[10px] px-3 h-10 cursor-pointer">
                    <span className="flex items-center gap-2 text-gray-700" style={{ fontSize: 12, fontWeight: 500 }}>
                      <Repeat size={13} />
                      Dépense récurrente (chaque mois)
                    </span>
                    <input
                      type="checkbox"
                      checked={form.recurring}
                      onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))}
                      className="h-4 w-4 accent-gray-900"
                    />
                  </label>

                  <div className="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={closeForm}
                      className="flex-1 h-9 bg-black/[0.04] text-gray-500 rounded-[10px] text-[12px] font-[500]"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={createExpense.isPending || updateExpense.isPending || parsed.sum === null}
                      className="flex-1 h-9 bg-gray-900 text-white rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] font-[600] disabled:opacity-60"
                    >
                      {(createExpense.isPending || updateExpense.isPending) ? <Loader2 size={12} className="animate-spin" /> : null}
                      {editing ? 'Enregistrer' : 'Créer'}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlowBackground>
  )
}

function Section({
  label, accent, expenses, total, onEdit, onDelete,
}: {
  label: string
  accent: string
  expenses: Expense[]
  total: number
  onEdit: (e: Expense) => void
  onDelete: (id: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className={`${accent}`} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </span>
        <span className="text-gray-700" style={{ fontSize: 11, fontWeight: 700 }}>
          {formatEur(total)}
        </span>
      </div>
      {expenses.length === 0 ? (
        <p className="text-gray-300 px-1 py-1" style={{ fontSize: 10, fontWeight: 500 }}>—</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {expenses.map(e => (
            <li
              key={e.id}
              className="group flex items-center justify-between gap-1 px-1 py-1 rounded-[6px] hover:bg-black/[0.03]"
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                {e.recurring && (
                  <Repeat size={9} className="text-gray-300 flex-shrink-0" />
                )}
                {e.amountFormula && (
                  <Sigma
                    size={9}
                    className="text-gray-400 flex-shrink-0"
                  />
                )}
                <span
                  className="text-gray-700 truncate"
                  style={{ fontSize: 11, fontWeight: 500 }}
                  title={e.amountFormula ? `${e.name}\n= ${e.amountFormula}` : e.name}
                >
                  {e.name}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-gray-900" style={{ fontSize: 11, fontWeight: 600 }}>
                  {formatEur(Number(e.amount))}
                </span>
                <div className="hidden group-hover:flex items-center gap-0.5">
                  <button
                    onClick={() => onEdit(e)}
                    className="text-gray-300 hover:text-gray-600 p-0.5"
                    aria-label="Modifier"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-gray-300 hover:text-red-400 p-0.5"
                    aria-label="Supprimer"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-gray-500" style={{ fontSize: 11, fontWeight: 600 }}>
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  )
}
