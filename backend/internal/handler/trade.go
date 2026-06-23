package handler

import (
	"net/http"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func HandleOpenPosition(tradeService *service.TradeService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity missing from execution context"})
			return 
		}
		userUUID, ok := userID.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return 
		}

		var req model.TradeRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body payload"})
			return 
		}

		response, err := tradeService.ExecuteOpenPosition(userUUID, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"new_balance": response.NewBalance,
		})	
	}
}

func HandleClosePosition(tradeService *service.TradeService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity missing from execution context"})
			return 
		}
		userUUID, ok := userID.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return 
		}

		positionIDStr := c.Param("id") 
		positionUUID, err := uuid.Parse(positionIDStr) 
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Missing or invalid path parameter: id must be a valid UUID string"})
			return
		}

		newBalance, realizedPnL, err := tradeService.ExecuteClosePosition(userUUID, positionUUID) 
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"new_balance":  newBalance,
			"realized_pnl": realizedPnL,
		})
	}
}

func HandleGetAccountBalanceOnly(tradeService *service.TradeService) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity missing from execution context"})
			return
        }
        userUUID, ok := userID.(uuid.UUID)
        if !ok {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
            return
        }

        summary, err := tradeService.ExecuteGetAccountSummary(userUUID)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        c.JSON(http.StatusOK, gin.H{
            "balance": summary.Balance,
        })
    }
}

func HandleGetActivePositions(tradeService *service.TradeService) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity missing from execution context"})
            return
        }
        userUUID, ok := userID.(uuid.UUID)
        if !ok {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
            return
        }

        positions, err := tradeService.ExecuteGetActivePositions(userUUID)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        if positions == nil {
            positions = []model.Position{}
        }

        c.JSON(http.StatusOK, positions)
    }
}

func HandleGetAccountSummary(tradeService *service.TradeService) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, exists := c.Get("user_id")
        if !exists {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity missing from execution context"})
            return
        }
        userUUID, ok := userID.(uuid.UUID)
        if !ok {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
            return
        }

        summary, err := tradeService.ExecuteGetAccountSummary(userUUID)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        c.JSON(http.StatusOK, summary)
    }
}

func HandleGetTradeHistory(tradeService *service.TradeService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity missing from execution context"})
			return
		}

		userUUID, ok := userID.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return
		}

		history, err := tradeService.ExecuteGetTradeHistory(userUUID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if history == nil {
			history = []model.Position{}
		}

		c.JSON(http.StatusOK, history)
	}
}