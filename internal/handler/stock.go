package handler

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/cache"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetStockPriceHandler(db *sql.DB, redisClient *cache.RedisClient) gin.HandlerFunc{
	return func(c *gin.Context){
		ticker := strings.ToUpper(c.Param("ticker"))

		price, err := redisClient.GetPrice(ticker) 
		if err == nil{
			c.JSON(http.StatusOK, gin.H{
				"ticker": ticker,
				"price": price,
				"source": "cache_memory",
			})
			return 
		}

		if !errors.Is(err, cache.ErrCacheMiss){
			log.Printf("Non-fatal Redis error: %v", err)
		}

		log.Printf("Cache miss for %s. falling back to postgress storage system...", ticker)
		price, err = storage.GetLatestPrice(db, ticker)
		if err != nil{
			c.JSON(http.StatusNotFound, gin.H{
				"error": err.Error(),
			})
			return 
		}

		if cacheErr := redisClient.SetPrice(ticker, price); cacheErr != nil{
			log.Printf("Failed to re-warm cache for %s: %v", ticker, cacheErr)
		}

		c.JSON(http.StatusOK, gin.H{
			"ticker": ticker,
			"price": price,
			"source": "relational_database",
		})
	}
}
