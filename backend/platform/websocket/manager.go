package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"stock-market-data-pipeline/internal/model"
	"sync"

	"github.com/gorilla/websocket"
)

type Manager struct {
	clients map[string]*websocket.Conn
	mu sync.RWMutex
}

func NewManager() *Manager{
	return &Manager{
		clients: make(map[string]*websocket.Conn),
	}
}

func (m *Manager) AddClient(userID string, conn *websocket.Conn){
	m.mu.Lock()
	defer m.mu.Unlock()

	m.clients[userID] = conn

}


func (m *Manager) RemoveClient(userID string, connToRemove *websocket.Conn){
	m.mu.Lock()
	defer m.mu.Unlock()

	if activeConn, exists := m.clients[userID]; exists{
		if activeConn == connToRemove{
			delete(m.clients, userID)
			connToRemove.Close()
		}
		
	}
	
}

func (m *Manager) SendToUser(userID string, message []byte) error{
	m.mu.RLock()
	conn, exists := m.clients[userID]
	m.mu.RUnlock()

	if !exists{
		return fmt.Errorf("user %s currently offline, websocket connection unavailable", userID)
	}

	err := conn.WriteMessage(websocket.TextMessage, message)
	if err != nil{
		m.RemoveClient(userID, conn)
		return fmt.Errorf("failed to transmit websocket payload to user %s: %w", userID, err)
	}

	return nil
}

func (m *Manager) BroadcastPrice(res model.StockPriceResponse){

	payload, err := json.Marshal(map[string]interface{}{

		"type": "price_update", 
		"ticker": res.Ticker,
		"price": res.Price,
		"volume": res.Volume,
		"timestamp":  res.Timestamp,
		"change":   res.Change,
		"change_percent": res.ChangePercent,
	})

	if err != nil{
		log.Printf("ERROR [WS Broadcast]: Failed to marshal price update payload for %s: %v", res.Ticker, err)
		return 
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	for userID, conn := range m.clients{
		err := conn.WriteMessage(websocket.TextMessage, payload)

		if err != nil{
			log.Printf("WARN [WS Broadcast]: Disconnecting dead client session %s: %v", userID, err)

			go m.RemoveClient(userID, conn)
		}
	}

}