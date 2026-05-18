package com.picsou.adapter;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.picsou.port.PriceProviderPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Fetches stock/ETF prices from Yahoo Finance (unofficial, no API key needed).
 * Used for PEA/Compte-Titres/Stocks/ETF positions with tickers like
 * "IWDA.AS", "MC.PA", "AAPL", etc.
 *
 * Prices are normalized to EUR: if the quoted currency is not EUR, an FX
 * rate is fetched from Yahoo (e.g. "EURUSD=X") and applied. FX rates are
 * cached for 15 minutes.
 *
 * Note: this is an unofficial API; for production consider Alpha Vantage.
 */
@Component
public class YahooFinancePriceProvider implements PriceProviderPort {

    private static final Logger log = LoggerFactory.getLogger(YahooFinancePriceProvider.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final long FX_CACHE_TTL_SECONDS = 900; // 15 minutes

    // Tickers that are handled by CoinGecko — we skip those
    private static final Set<String> CRYPTO_TICKERS = Set.of(
        "BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "DOT", "MATIC", "AVAX",
        "LTC", "LINK", "UNI", "ATOM", "NEAR", "ARB", "OP", "TRX", "SHIB",
        "USDT", "USDC", "DAI"
    );

    private final WebClient webClient;
    private final Map<String, CachedFx> fxCache = new ConcurrentHashMap<>();

    public YahooFinancePriceProvider() {
        this.webClient = WebClient.builder()
            .baseUrl("https://query1.finance.yahoo.com")
            .defaultHeader("Accept", "application/json")
            .defaultHeader("User-Agent", "Mozilla/5.0")
            .build();
    }

    @Override
    public boolean supports(String ticker) {
        return !CRYPTO_TICKERS.contains(ticker.toUpperCase());
    }

    @Override
    public Map<String, BigDecimal> getPricesEur(Set<String> tickers) {
        Set<String> supported = tickers.stream()
            .filter(this::supports)
            .collect(Collectors.toSet());

        if (supported.isEmpty()) return Map.of();

        Map<String, BigDecimal> result = new HashMap<>();

        // Yahoo Finance is fetched per-ticker (no batch endpoint for EUR conversion)
        for (String ticker : supported) {
            try {
                BigDecimal price = fetchEurPrice(ticker);
                if (price != null) result.put(ticker.toUpperCase(), price);
            } catch (Exception ex) {
                log.warn("Yahoo Finance price fetch failed for {}: {}", ticker, ex.getMessage());
            }
        }

        return result;
    }

    private BigDecimal fetchEurPrice(String ticker) {
        YahooResponse response = webClient.get()
            .uri("/v8/finance/chart/{ticker}?range=1d&interval=1d", ticker)
            .retrieve()
            .bodyToMono(YahooResponse.class)
            .timeout(TIMEOUT)
            .block();

        if (response == null || response.chart() == null || response.chart().result() == null
            || response.chart().result().isEmpty()) {
            return null;
        }

        var result = response.chart().result().get(0);
        if (result.meta() == null) return null;

        double price = result.meta().regularMarketPrice();
        if (price <= 0) return null;

        BigDecimal value = BigDecimal.valueOf(price);
        String currency = result.meta().currency();

        // Yahoo sometimes quotes UK stocks in pence (GBp) — divide by 100 to get GBP
        if ("GBp".equalsIgnoreCase(currency) || "GBX".equalsIgnoreCase(currency)) {
            value = value.divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
            currency = "GBP";
        }

        if (currency == null || currency.isBlank() || "EUR".equalsIgnoreCase(currency)) {
            return value;
        }

        BigDecimal fxRate = getEurFxRate(currency);
        if (fxRate == null) {
            log.warn("No FX rate available for {} → EUR, returning unconverted price for {}", currency, ticker);
            return value;
        }

        // fxRate = how many <currency> per 1 EUR. To convert <currency> → EUR, divide.
        return value.divide(fxRate, 8, RoundingMode.HALF_UP);
    }

    /**
     * Fetches EUR<CCY>=X from Yahoo. Returns the number of <CCY> per 1 EUR
     * (e.g. EURUSD=X ≈ 1.08 means 1 EUR = 1.08 USD).
     */
    private BigDecimal getEurFxRate(String currency) {
        String upper = currency.toUpperCase();
        CachedFx cached = fxCache.get(upper);
        if (cached != null && !cached.isExpired()) {
            return cached.rate();
        }

        try {
            YahooResponse response = webClient.get()
                .uri("/v8/finance/chart/EUR{ccy}=X?range=1d&interval=1d", upper)
                .retrieve()
                .bodyToMono(YahooResponse.class)
                .timeout(TIMEOUT)
                .block();

            if (response == null || response.chart() == null || response.chart().result() == null
                || response.chart().result().isEmpty()) {
                return null;
            }

            var meta = response.chart().result().get(0).meta();
            if (meta == null || meta.regularMarketPrice() <= 0) return null;

            BigDecimal rate = BigDecimal.valueOf(meta.regularMarketPrice());
            fxCache.put(upper, new CachedFx(rate, Instant.now()));
            return rate;
        } catch (Exception ex) {
            log.warn("Failed to fetch EUR{}=X FX rate: {}", upper, ex.getMessage());
            return null;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record YahooResponse(Chart chart) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Chart(List<ChartResult> result) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ChartResult(Meta meta) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Meta(double regularMarketPrice, String currency) {}

    private record CachedFx(BigDecimal rate, Instant cachedAt) {
        boolean isExpired() {
            return Instant.now().isAfter(cachedAt.plusSeconds(FX_CACHE_TTL_SECONDS));
        }
    }
}
