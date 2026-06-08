package handler

import (
	"database/sql"
	"net/http"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"

	"github.com/gin-gonic/gin"
)


func CreateAlertHandler(db *sql.DB) gin.HandlerFunc{
	return func(c *gin.Context){

		var req model.CreateAlertRequest

		err := c.ShouldBindJSON(&req)
		if err != nil{
			c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()})
			return 
		}

		userID := c.MustGet("user_id").(string)

		alert, err := storage.CreateAlert(db, userID, req)

		if err != nil{
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"alert":alert})

	}
}

func GetAlertsHandler(db *sql.DB) gin.HandlerFunc{
	return func(c *gin.Context){

		userID := c.MustGet("user_id").(string)

		alerts, err := storage.GetAlertByUserID(db, userID)

		if err != nil{
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if alerts == nil{
			alerts = []model.Alert{}
		}
		c.JSON(http.StatusOK, gin.H{"alerts":alerts})

	}
}

func UpdateAlertHandler(db *sql.DB) gin.HandlerFunc{
	return func(c *gin.Context){
		var req model.UpdateAlertRequest
		userID := c.MustGet("user_id").(string)
		alertID := c.Param("id")

		err := c.ShouldBindJSON(&req)

		if err != nil{
			c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()})
			return 
		}

		alert , err := storage.UpdateAlert(db, alertID, userID, req)

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

func DeleteAlertHandler(db *sql.DB) gin.HandlerFunc{
	return func(c *gin.Context) {

		alertID := c.Param("id")
		userID := c.MustGet("user_id").(string)

		err := storage.DeleteAlert(db, alertID, userID)

		if err != nil {
			if err.Error() == "alert not found or unauthorized to delete" {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return

	}
	c.JSON(http.StatusOK, gin.H{"messsage ": "alert successfully deleted"})

	}
}