package com.picsou.controller;

import com.picsou.model.Account;
import com.picsou.repository.AccountRepository;
import com.picsou.service.PriceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/prices")
public class PriceController {

    private final PriceService priceService;
    private final AccountRepository accountRepository;

    public PriceController(PriceService priceService, AccountRepository accountRepository) {
        this.priceService = priceService;
        this.accountRepository = accountRepository;
    }

    @GetMapping
    public Map<String, BigDecimal> getPrices(@RequestParam String tickers) {
        Set<String> tickerSet = Arrays.stream(tickers.split(","))
            .map(String::trim)
            .filter(t -> !t.isBlank())
            .collect(Collectors.toSet());

        return priceService.refreshPrices(tickerSet);
    }

    /**
     * Force-refresh prices for every account that has a ticker.
     * Bypasses the 15-minute cache by overwriting cached entries.
     */
    @PostMapping("/refresh")
    public RefreshResponse refreshAll() {
        Set<String> tickers = accountRepository.findByTickerIsNotNull().stream()
            .map(Account::getTicker)
            .filter(t -> t != null && !t.isBlank())
            .collect(Collectors.toSet());

        Map<String, BigDecimal> prices = priceService.refreshPrices(tickers);
        return new RefreshResponse(prices.size(), tickers.size(), prices, Instant.now());
    }

    public record RefreshResponse(
        int refreshed,
        int requested,
        Map<String, BigDecimal> prices,
        Instant refreshedAt
    ) {}
}
