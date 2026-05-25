package com.picsou.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "expense")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Expense extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, precision = 20, scale = 2)
    private BigDecimal amount;

    /** Raw user-entered formula like "61.51+36.48+44.01" — kept so the breakdown
     *  is editable later. Null when the user just typed a single number. */
    @Column(name = "amount_formula", length = 500)
    private String amountFormula;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    @Builder.Default
    private boolean recurring = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ExpenseCategory category;
}
