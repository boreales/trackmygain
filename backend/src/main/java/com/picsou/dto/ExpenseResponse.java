package com.picsou.dto;

import com.picsou.model.Expense;
import com.picsou.model.ExpenseCategory;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ExpenseResponse(
    Long id,
    String name,
    BigDecimal amount,
    String amountFormula,
    LocalDate date,
    boolean recurring,
    ExpenseCategory category,
    Instant createdAt
) {
    public static ExpenseResponse from(Expense e) {
        return new ExpenseResponse(
            e.getId(),
            e.getName(),
            e.getAmount(),
            e.getAmountFormula(),
            e.getDate(),
            e.isRecurring(),
            e.getCategory(),
            e.getCreatedAt()
        );
    }
}
