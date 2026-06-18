package handler

import (
	"errors"
	"log"
	"net/http"
	"stock-market-data-pipeline/internal/service"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/cache"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetStockPriceHandler(streamProc *service.StreamProcessor) gin.HandlerFunc {
	return func(c *gin.Context) {
		ticker := strings.ToUpper(c.Param("ticker"))

		redisClient := streamProc.RedisClient()

		var price float64
		var source string

		cachedPrice, err := redisClient.GetPrice("live", ticker)
		if err == nil {
			price = cachedPrice
			source = "cache_memory"
		} else {
			if !errors.Is(err, cache.ErrCacheMiss) {
				log.Printf("Non-fatal Redis error: %v", err)
			}

			log.Printf("Cache miss for %s. falling back to postgres storage system...", ticker)
			dbPrice, dbErr := storage.GetLatestPrice(streamProc.DB(), ticker)
			if dbErr != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": dbErr.Error()})
				return
			}
			price = dbPrice
			source = "relational_database"

			if cacheErr := redisClient.SetPrice("live", ticker, price, 3600); cacheErr != nil {
				log.Printf("Failed to re-warm cache for %s: %v", ticker, cacheErr)
			}
		}

		enrichedResponse, err := streamProc.ProcessLiveTick(ticker, price, 0)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Calculations engine failure"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"ticker":         enrichedResponse.Ticker,
			"price":          enrichedResponse.Price,
			"change":         enrichedResponse.Change,         
			"change_percent": enrichedResponse.ChangePercent,  
			"timestamp":      enrichedResponse.Timestamp,
			"source":         source,
		})
	}
}