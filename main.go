package main

import(
	"database/sql"
	"log"
	"os"
	"net/http"
	"github.com/gin-gonic/gin"
	"fmt"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
	"stock-market-data-pipeline/internal/handler"
	"stock-market-data-pipeline/internal/middleware"

)

var db *sql.DB


func getEnv(key , fallback string ) string{
	if value := os.Getenv(key); value != ""{
		return value
	}
	return fallback
}

func pingFunc(c *gin.Context){
	c.JSON(http.StatusOK, gin.H{"message":"working"})
}

func dbCheckHandler(c *gin.Context){
	var dbName string

	err := db.QueryRow("SELECT current_database()").Scan(&dbName)

	if err != nil{
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database query failed" + err.Error(),})
		return
	}
	c.JSON(http.StatusOK, gin.H{"database": dbName})
}

func connectDB(){
	connStr := getEnv("DATABASE_URL", "")
	if connStr == ""{
		log.Fatalf("Error: DATABASE_URL not set in .env")
	}
	var err error

	db, err = sql.Open("pgx", connStr)

	if err != nil{
		log.Fatalf("Failed to open database:%v", err)
	}
	err = db.Ping()
	if err != nil{
		log.Fatalf("Failed to ping db: %v", err)
	}

	fmt.Println("db connected!")

}

func main(){
	if err := godotenv.Load(); err != nil{
		fmt.Println("No .env file found, using system environment variables instead.")
	}
	connectDB()
	defer db.Close()
	r := gin.Default()

	
	r.GET("/ping", pingFunc)
	r.GET("/health", dbCheckHandler)

	auth := r.Group("/auth")

	{
		
		auth.POST("/signup", handler.SignUp(db) )
		auth.POST("/login", handler.Login(db))
	}

	protected := r.Group("/")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.POST("/alerts", handler.CreateAlertHandler(db))
		protected.GET("/alerts", handler.GetAlertsHandler(db))
		protected.PUT("/alerts/:id", handler.UpdateAlertHandler(db))
		protected.DELETE("/alerts/:id", handler.DeleteAlertHandler(db))
	}

	port := getEnv("PORT", "8080")
	fmt.Printf("🚀 Server running on port %s...\n", port)
	if err := r.Run(":"+ port); err != nil{
		log.Fatalf("failed to start server %v", err)
	}
}