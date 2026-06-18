package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"stock-market-data-pipeline/internal/alert"
	"stock-market-data-pipeline/internal/handler"
	"stock-market-data-pipeline/internal/middleware"
	"stock-market-data-pipeline/internal/service"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/alpaca"
	"stock-market-data-pipeline/platform/cache"
	"stock-market-data-pipeline/platform/seeder"
	"stock-market-data-pipeline/platform/websocket"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
)

var db *sql.DB
var redisCache *cache.RedisClient


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
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = db.PingContext(ctx)
	if err != nil {
		log.Fatalf("❌ Failed to ping db (timed out after 5s): %v", err)
	}
	fmt.Println("db connected!")

}

func main(){
	if err := godotenv.Load(); err != nil{
		fmt.Println("No .env file found, using system environment variables instead.")
	}
	connectDB()
	defer db.Close()

	go seeder.SeedHistoricalData(db, []string{"AAPL", "NVDA", "TSLA"})
	
	var err error
	redisCache, err = cache.NewRedisClient()
	if err != nil{
		log.Fatalf("Failed to connect to redis cache layer: %v", err)
	}

	fmt.Println("Redis cache connected successfully!")
	wsManager := websocket.NewManager()

	streamProc := service.NewStreamProcessor(db, redisCache)

	r := gin.Default()

	r.Use(middleware.CORSMiddleware())
	
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
		protected.GET("/ws", handler.HandleWebSocket(wsManager))
		protected.GET("/notifications", handler.GetNotificationsHandler(db))
		protected.GET("/stocks/:ticker/history", handler.GetStockHistoryHandler(db))
		protected.GET("/stocks/:ticker/price", handler.GetStockPriceHandler(streamProc))
	}

	port := getEnv("PORT", "8080")
	fmt.Printf("🚀 Server running on port %s...\n", port)

	go func(){
		
		client, err := alpaca.NewAlpacaClient()

		if err != nil{
			log.Printf("failed to create alpaca client: %v", err)
			return
		}

		if err := client.Authenticate(); err != nil {
			log.Printf("alpaca auth failed: %v", err)
			return
		}


		if err := client.Subscribe([]string{"NVDA", "AAPL", "TSLA"}); err != nil {
			log.Printf("❌ Critical error: failed to subscribe to market assets: %v", err)
			return
		}

		
		client.Listen(func(ticker string, price float64, volume int64) {
			log.Printf("💹 %s: $%.2f, %d", ticker, price, volume)

			go func(t string, p float64, v int64){
				err := storage.SaveStockPrice(db, t, p, v)
				if err != nil {
					log.Printf("⚠️ Database transaction skipped: %v", err)
				}

			}(ticker, price, volume)

			go func(t string, p float64){
				err := redisCache.SetPrice("live",t, p, 3600)
				if err != nil{
					log.Printf("Redis cache write failed for %s: %v",t, err)
				}
			}(ticker, price)

			go alert.CheckAndTriggerAlerts(db, wsManager,ticker, price)

			go func(t string, p float64, v int64){
				enrichedPayload, err := streamProc.ProcessLiveTick(t, p, v)
				if err != nil{
					log.Printf("⚠️ Calculation engine failure for %s: %v", t, err)
					return
				}
				wsManager.BroadcastPrice(enrichedPayload)

			}(ticker, price, volume)
		
		})

	}()
	


	if err := r.Run(":"+ port); err != nil{
		log.Fatalf("failed to start server %v", err)
	}
}