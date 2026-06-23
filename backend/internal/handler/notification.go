package handler

import (
	"database/sql"
	"net/http"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetNotificationsHandler(db *sql.DB) gin.HandlerFunc{
	return func (c *gin.Context){
		userID, exists := c.Get("user_id")
		if !exists{
			c.JSON(http.StatusUnauthorized, gin.H{"error":"Unauthorized user context"})
			return 
		}

		var userIDStr string
		if uuidVal, ok := userID.(uuid.UUID); ok {
			userIDStr = uuidVal.String()
		} else if strVal, ok := userID.(string); ok {
			userIDStr = strVal
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return
		}
		
		notifications, err := storage.GetNotificationsByUserID(db, userIDStr)

		if err != nil{
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve notification history: " + err.Error()})
			return
		}

		if notifications == nil {
			notifications = []model.NotificationPayload{}
		}

		c.JSON(http.StatusOK, notifications)
	}
}