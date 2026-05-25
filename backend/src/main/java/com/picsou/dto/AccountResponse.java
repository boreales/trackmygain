package com.picsou.dto;

import com.picsou.model.Account;
import com.picsou.model.AccountType;

import java.math.BigDecimal;
import java.time.Instant;

public record AccountResponse(
    Long id,
    String name,
    AccountType type,
    String provider,
    String currency,
    BigDecimal currentBalance,
    BigDecimal currentBalanceEur,
    Instant lastSyncedAt,
    boolean isManual,
    String color,
    String ticker,
    Instant createdAt,
    /** EUR variation since the previous price refresh: (last_price - previous_price) * currentBalance.
     *  Null when the account has no ticker or fewer than 2 refreshes have been recorded yet. */
    BigDecimal priceTrendEur
) {
    public static AccountResponse from(Account a, BigDecimal balanceEur) {
        BigDecimal trend = null;
        if (a.getLastPriceEur() != null && a.getPreviousPriceEur() != null && a.getCurrentBalance() != null) {
            trend = a.getLastPriceEur().subtract(a.getPreviousPriceEur()).multiply(a.getCurrentBalance());
        }
        return new AccountResponse(
            a.getId(),
            a.getName(),
            a.getType(),
            a.getProvider(),
            a.getCurrency(),
            a.getCurrentBalance(),
            balanceEur,
            a.getLastSyncedAt(),
            a.isManual(),
            a.getColor(),
            a.getTicker(),
            a.getCreatedAt(),
            trend
        );
    }
}
