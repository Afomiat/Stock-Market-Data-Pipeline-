package handler

import (
	"log"
	"net/http"
	wsclient "stock-market-data-pipeline/platform/websocket"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid" 
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func HandleWebSocket(manager *wsclient.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized user context"})
			return
		}

		userUUID, ok := userID.(uuid.UUID)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid identification type mapping"})
			return
		}
		userIDStr := userUUID.String() 

		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("Failed to upgrade HTTP connection to webSocket: %v", err)
			return
		}

		manager.AddClient(userIDStr, conn)
		log.Printf("User %s successfully linked to real-time WebSocket stream manager", userIDStr)

		go func() {
			defer func() {
				manager.RemoveClient(userIDStr, conn)
				log.Printf("User %s disconnected from WebSocket", userIDStr)
			}()

			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					break
				}
			}
		}()
	}
}