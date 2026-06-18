package handler

import (
	"database/sql"
	"net/http"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"

	"github.com/gin-gonic/gin"
)

func GetNotificationsHandler(db *sql.DB) gin.HandlerFunc{
	return func (c *gin.Context){
		userID, exists := c.Get("user_id")
		if !exists{
			c.JSON(http.StatusUnauthorized, gin.H{"error":"Unauthorized user context"})
			return 
		}
		userIDStr := userID.(string)

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