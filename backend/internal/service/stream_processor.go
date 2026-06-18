package service

import (
	"database/sql"
	"log"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/cache"
	"sync"
	"time"
)

type StreamProcessor struct {
	db             *sql.DB
	redisClient    *cache.RedisClient
	openPriceCache map[string]float64
	cacheMutex     sync.RWMutex
}



func NewStreamProcessor(db *sql.DB, redisClient *cache.RedisClient) *StreamProcessor {
	return &StreamProcessor{
		db:             db,
		redisClient:    redisClient,
		openPriceCache: map[string]float64{},
	}
}
func (sp *StreamProcessor) RedisClient() *cache.RedisClient {
	return sp.redisClient
}

func (sp *StreamProcessor) DB() *sql.DB {
	return sp.db
}

func (sp *StreamProcessor) GetOrFetchOpenPrice(ticker string) (float64, error) {
	sp.cacheMutex.RLock()
	price, exists := sp.openPriceCache[ticker]
	sp.cacheMutex.RUnlock()

	if exists {
		return price, nil
	}

	openPrice, err := sp.redisClient.GetPrice("open",ticker)
	if err == nil {
		sp.cacheMutex.Lock()
		sp.openPriceCache[ticker] = openPrice
		sp.cacheMutex.Unlock()
		return openPrice, nil
	}

	openPrice, err = storage.GetTodayOpenPrice(sp.db, ticker)
	if err != nil {
		return 0, err
	}

	now := time.Now().UTC()
	midnight := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, time.UTC)
	secondsLeft := int(midnight.Sub(now).Seconds())

	if secondsLeft <= 0 {
		secondsLeft = 3600
	}

	if cacheErr := sp.redisClient.SetPrice("open", ticker, openPrice, secondsLeft); cacheErr != nil {
		log.Printf("Warning: Failed to back-fill Upstash Redis cache: %v", cacheErr)
	}

	sp.cacheMutex.Lock()
	sp.openPriceCache[ticker] = openPrice
	sp.cacheMutex.Unlock()

	return openPrice, nil

}

func (sp *StreamProcessor) ProcessLiveTick(ticker string, currentPrice float64, currentVolume int64) (model.StockPriceResponse, error) {

	todayOpenPrice, err := sp.GetOrFetchOpenPrice(ticker)
	if err != nil {
		log.Printf("Warning: fallback calculation used for %s: %v", ticker, err)
		todayOpenPrice = currentPrice
	}

	change := currentPrice - todayOpenPrice
	changePercent := 0.0
	if todayOpenPrice > 0 {
		changePercent = (change / todayOpenPrice) * 100
	}

	return model.StockPriceResponse{
		Ticker:        ticker,
		Price:         currentPrice,
		Volume:        currentVolume,
		Timestamp:     time.Now(),
		Change:        change,
		ChangePercent: changePercent,
	}, nil
}
