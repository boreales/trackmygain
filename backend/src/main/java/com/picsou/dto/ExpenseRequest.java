package com.picsou.dto;

import com.picsou.model.ExpenseCategory;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExpenseRequest(
    @NotBlank @Size(max = 255) String name,
    @NotNull @DecimalMin("0.0") BigDecimal amount,
    @Size(max = 500) String amountFormula,
    @NotNull LocalDate date,
    boolean recurring,
    @NotNull ExpenseCategory category
) {}
