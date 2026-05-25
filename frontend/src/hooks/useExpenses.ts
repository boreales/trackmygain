import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expensesApi, type ExpenseRequest } from '../lib/api'

export const EXPENSES_KEY = ['expenses'] as const

export function useExpenses() {
  return useQuery({
    queryKey: EXPENSES_KEY,
    queryFn: expensesApi.list,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ExpenseRequest) => expensesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseRequest }) =>
      expensesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => expensesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  })
}
