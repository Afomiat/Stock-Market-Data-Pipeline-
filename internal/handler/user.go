package handler

import(
	"net/http"
	"github.com/gin-gonic/gin"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"
	"database/sql"

)

func SignUp(db *sql.DB) gin.HandlerFunc{
	return func(c *gin.Context){
		var userReq model.RegisterRequest

		err := c.ShouldBindJSON(&userReq)
		if err != nil{
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user , err := storage.CreateUser(db, userReq)
		if err != nil{
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"user": user})
	}
}