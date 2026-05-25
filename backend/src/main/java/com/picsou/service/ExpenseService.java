package com.picsou.service;

import com.picsou.dto.ExpenseRequest;
import com.picsou.dto.ExpenseResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Expense;
import com.picsou.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class ExpenseService {

    private final ExpenseRepository expenseRepository;

    public ExpenseService(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
    }

    public List<ExpenseResponse> findAll() {
        return expenseRepository.findAllByOrderByDateAsc().stream()
            .map(ExpenseResponse::from)
            .toList();
    }

    public ExpenseResponse findById(Long id) {
        return ExpenseResponse.from(getOrThrow(id));
    }

    @Transactional
    public ExpenseResponse create(ExpenseRequest req) {
        Expense expense = Expense.builder()
            .name(req.name())
            .amount(req.amount())
            .amountFormula(normalizeFormula(req.amountFormula()))
            .date(req.date())
            .recurring(req.recurring())
            .category(req.category())
            .build();
        return ExpenseResponse.from(expenseRepository.save(expense));
    }

    @Transactional
    public ExpenseResponse update(Long id, ExpenseRequest req) {
        Expense expense = getOrThrow(id);
        expense.setName(req.name());
        expense.setAmount(req.amount());
        expense.setAmountFormula(normalizeFormula(req.amountFormula()));
        expense.setDate(req.date());
        expense.setRecurring(req.recurring());
        expense.setCategory(req.category());
        return ExpenseResponse.from(expenseRepository.save(expense));
    }

    @Transactional
    public void delete(Long id) {
        if (!expenseRepository.existsById(id)) {
            throw expenseNotFound(id);
        }
        expenseRepository.deleteById(id);
    }

    private Expense getOrThrow(Long id) {
        return expenseRepository.findById(id)
            .orElseThrow(() -> expenseNotFound(id));
    }

    private static ResourceNotFoundException expenseNotFound(Long id) {
        return new ResourceNotFoundException("Expense not found: " + id);
    }

    /** Persist the formula only when it actually contains a breakdown (more than one term). */
    private static String normalizeFormula(String formula) {
        if (formula == null) return null;
        String trimmed = formula.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.contains("+") ? trimmed : null;
    }
}
