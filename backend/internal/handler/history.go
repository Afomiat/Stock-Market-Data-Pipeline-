package handler

import (
	"database/sql"
	"net/http"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"
	"time"

	"github.com/gin-gonic/gin"
)

func GetStockHistoryHandler(db *sql.DB) gin.HandlerFunc{
	return func(c *gin.Context) {

		ticker := c.Param("ticker")
		if ticker == ""{
			c.JSON(http.StatusBadRequest, gin.H{"error": "Missing stock ticker path parameter"})
			return 
		}

		userInterval := c.DefaultQuery("interval", "1m")

		var timescaleInterval string
		var lookbackDuration time.Duration

		switch userInterval {
		// Intraday Scaling Frames
		case "1m":
			timescaleInterval = "1 minute"
			lookbackDuration = 24 * time.Hour 
		case "3m":
			timescaleInterval = "3 minutes"
			lookbackDuration = 24 * time.Hour
		case "5m":
			timescaleInterval = "5 minutes"
			lookbackDuration = 48 * time.Hour 
		case "15m":
			timescaleInterval = "15 minutes"
			lookbackDuration = 3 * 24 * time.Hour 
		case "30m":
			timescaleInterval = "30 minutes"
			lookbackDuration = 5 * 24 * time.Hour 

		// Hourly Swing Frames
		case "1h":
			timescaleInterval = "1 hour"
			lookbackDuration = 7 * 24 * time.Hour 
		case "2h":
			timescaleInterval = "2 hours"
			lookbackDuration = 14 * 24 * time.Hour 
		case "4h":
			timescaleInterval = "4 hours"
			lookbackDuration = 30 * 24 * time.Hour 

		// Macro Investor Trend Frames
		case "1d":
			timescaleInterval = "1 day"
			lookbackDuration = 365 * 24 * time.Hour 
		case "1w":
			timescaleInterval = "1 week"
			lookbackDuration = 3 * 365 * 24 * time.Hour 
		case "1M":
			timescaleInterval = "1 month"
			lookbackDuration = 5 * 365 * 24 * time.Hour 

		default:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Unsupported interval timeframe",
				"supported_options": []string{"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1M"},
			})
			return
		}

		startTime := time.Now().Add(-lookbackDuration)
		candles, err := storage.GetStockHistory(db ,ticker, timescaleInterval, startTime)
		if err != nil{
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to aggregate historical canlestick row",
				"details": err.Error(),
			})
			return 
		}

		if candles == nil {
			c.JSON(http.StatusOK, []model.OHLCVCandle{})
			return
		}

		c.JSON(http.StatusOK, candles)
	}
}
