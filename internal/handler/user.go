package handler

import(
	"net/http"
	"github.com/gin-gonic/gin"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/token"
	"database/sql"
	"golang.org/x/crypto/bcrypt"

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
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"user": user})
	}
}

func Login(db *sql.DB) gin.HandlerFunc{
	return func(c *gin.Context){
		var userReq model.LoginRequest

		err := c.ShouldBindJSON(&userReq)
		if err != nil{
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, passwordHash, err := storage.GetUserByEmail(db, userReq.Email)

		if err != nil{
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid email or password"})
			return
		}

		err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(userReq.Password))

		if err != nil{
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}

		tokenStr, err := token.GenerateToken(user.ID.String())


		if err != nil{
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate session"})
			return			
		}

		res := model.LoginResponse{
			Token : tokenStr,
			User : *user,
		}

		c.JSON(http.StatusOK, gin.H{"user": res})



	}
}