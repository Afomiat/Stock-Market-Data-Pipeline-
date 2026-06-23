package handler

import (
	"database/sql"
	"net/http"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func CreateAlertHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req model.CreateAlertRequest

		err := c.ShouldBindJSON(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return 
		}

		userIDContext, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity context missing"})
			return
		}
		userUUID, ok := userIDContext.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return
		}

		alert, err := storage.CreateAlert(db, userUUID, req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"alert": alert})
	}
}

func GetAlertsHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDContext, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity context missing"})
			return
		}
		userUUID, ok := userIDContext.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return
		}

		alerts, err := storage.GetAlertByUserID(db, userUUID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if alerts == nil {
			alerts = []model.Alert{}
		}
		c.JSON(http.StatusOK, gin.H{"alerts": alerts})
	}
}

func UpdateAlertHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req model.UpdateAlertRequest
		userIDContext, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity context missing"})
			return
		}
		userUUID, ok := userIDContext.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return
		}

		alertIDStr := c.Param("id")
		alertUUID, err := uuid.Parse(alertIDStr) 
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID format: must be a valid UUID"})
			return
		}

		err = c.ShouldBindJSON(&req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return 
		}

		alert, err := storage.UpdateAlert(db, alertUUID, userUUID, req)
		if err != nil {
			if err.Error() == "alert not found or unauthorized to modify" {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"alert": alert})
	}
}

func DeleteAlertHandler(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDContext, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identity context missing"})
			return
		}
		userUUID, ok := userIDContext.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return
		}

		alertIDStr := c.Param("id")
		alertUUID, err := uuid.Parse(alertIDStr) 
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert ID format: must be a valid UUID"})
			return
		}

		err = storage.DeleteAlert(db, alertUUID, userUUID)
		if err != nil {
			if err.Error() == "alert not found or unauthorized to delete" {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "alert successfully deleted"})
	}
}