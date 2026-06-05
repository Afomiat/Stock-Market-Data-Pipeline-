package middleware

import(
	"stock-market-data-pipeline/platform/token"
	"strings"
	"net/http"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc{
	return func(c *gin.Context){
		authHeader := c.GetHeader("Authorization")
		if authHeader == ""{
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Autorization header is required"})
			c.Abort()

			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer"{
			c.JSON(http.StatusUnauthorized, gin.H{"error":"Authorization header must be bearer token"})
			c.Abort()
			return
		}

		tokenStr := parts[1]

		userID, err := token.ValidateToken(tokenStr)
		if err != nil{
			c.JSON(http.StatusUnauthorized, gin.H{"error":"Invalid or expired token"})
			c.Abort()
			return
		}
		c.Set("user_id", userID)
		c.Next()
	}
}