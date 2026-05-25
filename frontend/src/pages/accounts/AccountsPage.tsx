import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Wallet, X, Loader2, Pencil, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount, useRefreshPrices } from '../../hooks/useAccounts'
import { GlassCard, GlowBackground, PageHeader } from '../../components/shared'
import { formatEur, accountTypeLabel, accountTypeNeedsTicker } from '../../lib/utils'
import type { Account, AccountType } from '../../lib/api'

const ACCOUNT_TYPES: AccountType[] = ['LEP', 'PEA', 'COMPTE_TITRES', 'CRYPTO', 'STOCKS', 'ETF', 'CHECKING', 'SAVINGS', 'OTHER']
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

type CategoryKey = 'PRO' | 'ACTIONS' | 'CRYPTO' | 'EPARGNE' | 'AUTRES'

const CATEGORY_META: Record<CategoryKey, { label: string; color: string; gradient: string }> = {
  PRO:     { label: 'Pro',     color: '#8b5cf6', gradient: 'from-violet-400 to-purple-500' },
  ACTIONS: { label: 'Actions', color: '#6366f1', gradient: 'from-indigo-400 to-blue-500' },
  CRYPTO:  { label: 'Crypto',  color: '#f59e0b', gradient: 'from-amber-400 to-orange-500' },
  EPARGNE: { label: 'Épargne', color: '#10b981', gradient: 'from-emerald-400 to-teal-500' },
  AUTRES:  { label: 'Autres',  color: '#64748b', gradient: 'from-slate-400 to-slate-500' },
}

function categorize(account: Account): CategoryKey {
  const name = account.name.trim().toLowerCase()
  if (name === 'trésorerie' || name === 'tresorerie' || name === 'compte pro') return 'PRO'
  switch (account.type) {
    case 'STOCKS': case 'ETF': case 'PEA': case 'COMPTE_TITRES': return 'ACTIONS'
    case 'CRYPTO': return 'CRYPTO'
    case 'LEP': case 'SAVINGS': case 'CHECKING': return 'EPARGNE'
    default: return 'AUTRES'
  }
}

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()
  const refreshPrices = useRefreshPrices()
  const navigate = useNavigate()
  const hasTrackedAssets = (accounts ?? []).some(a => a.ticker)
  const [showForm, setShowForm] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null)

  // Price-only trend since last refresh, served by the backend per account.
  const trendByAccountId = new Map<number, number>()
  for (const a of accounts ?? []) {
    if (a.priceTrendEur != null) trendByAccountId.set(a.id, a.priceTrendEur)
  }
  const [form, setForm] = useState({
    name: '', type: 'SAVINGS' as AccountType, provider: '',
    currency: 'EUR', currentBalance: '', isManual: true, color: '#6366f1', ticker: '',
  })

  const emptyForm = { name: '', type: 'SAVINGS' as AccountType, provider: '', currency: 'EUR', currentBalance: '', isManual: true, color: '#6366f1', ticker: '' }

  const openCreate = () => { setEditingAccount(null); setForm(emptyForm); setShowForm(true) }
  const openEdit = (account: Account) => {
    setEditingAccount(account)
    setForm({
      name: account.name,
      type: account.type,
      provider: account.provider ?? '',
      currency: account.currency,
      currentBalance: String(account.currentBalance),
      isManual: account.isManual,
      color: account.color,
      ticker: account.ticker ?? '',
    })
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditingAccount(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      name: form.name,
      type: form.type,
      provider: form.provider || undefined,
      currency: form.currency,
      currentBalance: form.currentBalance ? parseFloat(form.currentBalance) : undefined,
      isManual: form.isManual,
      color: form.color,
      ticker: form.ticker || undefined,
    }
    if (editingAccount) {
      await updateAccount.mutateAsync({ id: editingAccount.id, data })
    } else {
      await createAccount.mutateAsync(data)
    }
    closeForm()
  }

  return (
    <GlowBackground
      glows={[
        { color: 'bg-emerald-200/15', size: 350, blur: 120, position: '-top-10 right-1/3' },
        { color: 'bg-teal-100/20', size: 280, blur: 100, position: 'bottom-5 left-1/4' },
      ]}
    >
      <PageHeader
        surtitle="Portefeuille"
        title="Comptes"
        actions={
          <div className="flex items-center gap-2">
            {hasTrackedAssets && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => refreshPrices.mutate()}
                disabled={refreshPrices.isPending}
                title="Rafraîchir les cours crypto / actions / ETF"
                className="flex items-center gap-1.5 h-8 px-3 bg-white/70 text-gray-700 rounded-[10px] disabled:opacity-60"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                <RefreshCw size={13} className={refreshPrices.isPending ? 'animate-spin' : ''} />
                {refreshPrices.isPending ? 'Mise à jour…' : 'Rafraîchir les cours'}
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={openCreate}
              className="flex items-center gap-1.5 h-8 px-3 bg-gray-900 text-white rounded-[10px]"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              <Plus size={14} /> Ajouter
            </motion.button>
          </div>
        }
      />

      {!isLoading && (accounts ?? []).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <GlassCard>
            <p className="text-gray-400 mb-1" style={{ fontSize: 13, fontWeight: 500 }}>
              Patrimoine total
            </p>
            <p className="text-gray-900" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>
              {formatEur((accounts ?? []).reduce((s, a) => s + a.currentBalanceEur, 0))}
            </p>
          </GlassCard>
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-white/60 rounded-[20px]" />
          ))}
        </div>
      ) : (accounts ?? []).length === 0 ? (
        <p className="text-gray-400 py-8 text-center" style={{ fontSize: 13 }}>
          Aucun compte. Cliquez sur "Ajouter" pour commencer.
        </p>
      ) : (() => {
        const all = accounts ?? []
        const grouped = all.reduce((acc, a) => {
          const k = categorize(a)
          ;(acc[k] ||= []).push(a)
          return acc
        }, {} as Record<CategoryKey, Account[]>)
        const order: CategoryKey[] = ['PRO', 'ACTIONS', 'CRYPTO', 'EPARGNE', 'AUTRES']
        const visible = order.filter(k => (grouped[k]?.length ?? 0) > 0)

        return (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
              <AnimatePresence>
                {visible.map((key, i) => {
                  const list = grouped[key]!
                  const total = list.reduce((s, a) => s + a.currentBalanceEur, 0)
                  const meta = CATEGORY_META[key]
                  const isActive = expandedCategory === key
                  const showTrend = key === 'ACTIONS' || key === 'CRYPTO'
                  const catTrend = showTrend
                    ? list.reduce((s, a) => s + (trendByAccountId.get(a.id) ?? 0), 0)
                    : undefined
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setExpandedCategory(isActive ? null : key)}
                      className={`relative aspect-square w-40 sm:w-44 lg:w-48 rounded-full bg-gradient-to-br ${meta.gradient} text-white shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col items-center justify-center px-4 transition-shadow ${isActive ? 'ring-4 ring-white/70 shadow-[0_16px_48px_rgba(0,0,0,0.18)]' : ''}`}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.4 }} className="opacity-90 uppercase">
                        {meta.label}
                      </span>
                      <span className="mt-1.5" style={{ fontSize: 20, fontWeight: 700 }}>
                        {formatEur(total, { compact: total >= 100000 })}
                      </span>
                      <span className="mt-1 opacity-75" style={{ fontSize: 11, fontWeight: 500 }}>
                        {list.length} compte{list.length > 1 ? 's' : ''}
                      </span>
                      {showTrend && (
                        <span className="mt-1.5">
                          <TrendBadge trend={catTrend} size={11} />
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              {expandedCategory && grouped[expandedCategory] && (
                <motion.div
                  key={expandedCategory}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-gray-900" style={{ fontSize: 15, fontWeight: 600 }}>
                      {CATEGORY_META[expandedCategory].label} — détail
                    </h2>
                    <button
                      onClick={() => setExpandedCategory(null)}
                      className="text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      style={{ fontSize: 12, fontWeight: 500 }}
                    >
                      <X size={14} /> Fermer
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {grouped[expandedCategory]!.map((account, i) => (
                      <motion.div
                        key={account.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <GlassCard
                          onClick={() => navigate(`/accounts/${account.id}`)}
                          className="cursor-pointer hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                                style={{ background: account.color + '20' }}
                              >
                                <Wallet size={16} style={{ color: account.color }} />
                              </div>
                              <div>
                                <p className="text-gray-900" style={{ fontSize: 14, fontWeight: 600 }}>
                                  {account.name}
                                </p>
                                <p className="text-gray-400" style={{ fontSize: 11, fontWeight: 500 }}>
                                  {accountTypeLabel(account.type)}
                                  {account.provider ? ` · ${account.provider}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); openEdit(account) }}
                                className="text-gray-300 hover:text-gray-600 transition-colors p-1"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  if (confirm('Supprimer ce compte ?')) deleteAccount.mutate(account.id)
                                }}
                                className="text-gray-300 hover:text-red-400 transition-colors p-1"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-baseline gap-2 mt-2 flex-wrap">
                            <p className="text-gray-900" style={{ fontSize: 22, fontWeight: 700 }}>
                              {formatEur(account.currentBalanceEur)}
                            </p>
                            {(expandedCategory === 'ACTIONS' || expandedCategory === 'CRYPTO') && (
                              <TrendBadge trend={trendByAccountId.get(account.id)} size={12} onLight />
                            )}
                          </div>
                          {account.currency !== 'EUR' && (
                            <p className="text-gray-400" style={{ fontSize: 11, fontWeight: 500 }}>
                              {account.currentBalance.toFixed(account.currency === 'BTC' ? 8 : 2)} {account.currency}
                            </p>
                          )}
                          {account.lastSyncedAt && (
                            <p className="text-gray-300 mt-1" style={{ fontSize: 11, fontWeight: 500 }}>
                              Sync {new Date(account.lastSyncedAt).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </GlassCard>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })()}

      {/* Create / Edit modal */}
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
                    {editingAccount ? 'Modifier le compte' : 'Nouveau compte'}
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
                      placeholder="Mon LEP"
                      className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type">
                      <select
                        value={form.type}
                        onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
                        className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                      >
                        {ACCOUNT_TYPES.map(t => (
                          <option key={t} value={t}>{accountTypeLabel(t)}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Devise">
                      <input
                        value={form.currency}
                        onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                        placeholder="EUR"
                        maxLength={10}
                        className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Solde initial">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={form.currentBalance}
                        onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))}
                        placeholder="0.00"
                        className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </Field>
                    <Field label={accountTypeNeedsTicker(form.type) ? 'Ticker (cours suivi)' : 'Ticker (optionnel)'}>
                      <input
                        value={form.ticker}
                        onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                        placeholder={
                          form.type === 'CRYPTO' ? 'BTC, ETH, SOL…' :
                          form.type === 'ETF' ? 'IWDA.AS, CW8.PA…' :
                          form.type === 'STOCKS' ? 'AAPL, MC.PA, ASML.AS…' :
                          'BTC, IWDA.AS'
                        }
                        maxLength={20}
                        className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </Field>
                  </div>

                  <Field label="Fournisseur">
                    <input
                      value={form.provider}
                      onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                      placeholder="BoursoBank, Revolut…"
                      className="h-8 px-3 w-full rounded-[10px] bg-black/[0.03] text-[13px] border-none outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </Field>

                  <Field label="Couleur">
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map(c => (
                        <button
                          key={c} type="button"
                          onClick={() => setForm(f => ({ ...f, color: c }))}
                          className="w-6 h-6 rounded-full transition-transform"
                          style={{
                            background: c,
                            transform: form.color === c ? 'scale(1.25)' : 'scale(1)',
                            boxShadow: form.color === c ? `0 0 0 2px white, 0 0 0 3px ${c}` : undefined,
                          }}
                        />
                      ))}
                    </div>
                  </Field>

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
                      disabled={createAccount.isPending || updateAccount.isPending}
                      className="flex-1 h-9 bg-gray-900 text-white rounded-[10px] flex items-center justify-center gap-1.5 text-[12px] font-[600] disabled:opacity-60"
                    >
                      {(createAccount.isPending || updateAccount.isPending) ? <Loader2 size={12} className="animate-spin" /> : null}
                      {editingAccount ? 'Enregistrer' : 'Créer'}
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

function TrendBadge({ trend, size = 11, onLight = false }: { trend: number | undefined; size?: number; onLight?: boolean }) {
  if (trend === undefined) return null
  const epsilon = 0.5 // ignore ~zero
  if (Math.abs(trend) < epsilon) {
    const Icon = Minus
    return (
      <span className={`inline-flex items-center gap-1 ${onLight ? 'text-gray-400' : 'text-white/70'}`} style={{ fontSize: size, fontWeight: 600 }}>
        <Icon size={size + 2} /> {formatEur(0)}
      </span>
    )
  }
  const positive = trend > 0
  const Icon = positive ? TrendingUp : TrendingDown
  const colorClass = onLight
    ? (positive ? 'text-emerald-600' : 'text-red-500')
    : (positive ? 'text-emerald-100' : 'text-red-100')
  return (
    <span className={`inline-flex items-center gap-1 ${colorClass}`} style={{ fontSize: size, fontWeight: 600 }}>
      <Icon size={size + 2} />
      {positive ? '+' : ''}{formatEur(trend)}
    </span>
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
