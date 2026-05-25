package com.picsou.service;

import com.picsou.dto.ExpenseRequest;
import com.picsou.dto.ExpenseResponse;
import com.picsou.exception.ResourceNotFoundException;
import com.picsou.model.Expense;
import com.picsou.model.ExpenseCategory;
import com.picsou.repository.ExpenseRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceTest {

    @Mock ExpenseRepository expenseRepository;
    @InjectMocks ExpenseService expenseService;

    @Test
    void create_persistsExpenseAndReturnsResponse() {
        ExpenseRequest req = new ExpenseRequest(
            "Loyer", new BigDecimal("1200.00"), null,
            LocalDate.of(2026, 1, 1), true, ExpenseCategory.PERSO
        );
        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> {
            Expense e = inv.getArgument(0);
            e.setId(42L);
            return e;
        });

        ExpenseResponse res = expenseService.create(req);

        ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
        verify(expenseRepository).save(captor.capture());
        Expense saved = captor.getValue();
        assertThat(saved.getName()).isEqualTo("Loyer");
        assertThat(saved.getAmount()).isEqualByComparingTo("1200.00");
        assertThat(saved.isRecurring()).isTrue();
        assertThat(saved.getCategory()).isEqualTo(ExpenseCategory.PERSO);
        assertThat(res.id()).isEqualTo(42L);
    }

    @Test
    void update_mutatesExistingExpense() {
        Expense existing = Expense.builder()
            .id(7L)
            .name("Old")
            .amount(new BigDecimal("100.00"))
            .date(LocalDate.of(2026, 3, 1))
            .recurring(false)
            .category(ExpenseCategory.PRO)
            .build();
        when(expenseRepository.findById(7L)).thenReturn(Optional.of(existing));
        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpenseResponse res = expenseService.update(7L, new ExpenseRequest(
            "New", new BigDecimal("141.99"), "61.50+44.50+35.99",
            LocalDate.of(2026, 4, 1), true, ExpenseCategory.PERSO
        ));

        assertThat(res.name()).isEqualTo("New");
        assertThat(res.amount()).isEqualByComparingTo("141.99");
        assertThat(res.amountFormula()).isEqualTo("61.50+44.50+35.99");
        assertThat(res.recurring()).isTrue();
        assertThat(res.category()).isEqualTo(ExpenseCategory.PERSO);
    }

    @Test
    void delete_throwsWhenMissing() {
        when(expenseRepository.existsById(99L)).thenReturn(false);
        assertThatThrownBy(() -> expenseService.delete(99L))
            .isInstanceOf(ResourceNotFoundException.class);
        verify(expenseRepository, never()).deleteById(any());
    }
}
