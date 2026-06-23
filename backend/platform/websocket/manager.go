package websocket

import (
	"encoding/json"
	"fmt"
	"stock-market-data-pipeline/internal/model"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn *websocket.Conn
	mu   sync.Mutex 
}

type Manager struct {
	clients map[string]*Client
	mu      sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		clients: make(map[string]*Client),
	}
}

func (m *Manager) AddClient(userID string, conn *websocket.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clients[userID] = &Client{conn: conn}
}

func (m *Manager) RemoveClient(userID string, connToRemove *websocket.Conn) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if client, exists := m.clients[userID]; exists {
		if client.conn == connToRemove {
			delete(m.clients, userID)
			client.conn.Close()
		}
	}
}

func (m *Manager) SendToUser(userID string, message []byte) error {
	m.mu.RLock()
	client, exists := m.clients[userID]
	m.mu.RUnlock()
	if !exists {
		return fmt.Errorf("user %s offline", userID)
	}

	client.mu.Lock() 
	err := client.conn.WriteMessage(websocket.TextMessage, message)
	client.mu.Unlock() 

	if err != nil {
		m.RemoveClient(userID, client.conn)
		return err
	}
	return nil
}

func (m *Manager) BroadcastPrice(res model.StockPriceResponse) {
	payload, err := json.Marshal(map[string]interface{}{
		"ticker":         res.Ticker,
		"price":          res.Price,
		"volume":         res.Volume,
		"timestamp":      res.Timestamp,
		"change":         res.Change,
		"change_percent": res.ChangePercent,
	})
	if err != nil {
		return
	}

	m.mu.RLock()
	clientsCopy := make(map[string]*Client)
	for id, client := range m.clients {
		clientsCopy[id] = client
	}
	m.mu.RUnlock()

	type deadClient struct {
		id   string
		conn *websocket.Conn
	}
	var targets []deadClient

	for userID, client := range clientsCopy {
		client.mu.Lock() 
		err := client.conn.WriteMessage(websocket.TextMessage, payload)
		client.mu.Unlock()
		if err != nil {
			targets = append(targets, deadClient{id: userID, conn: client.conn})
		}
	}

	for _, target := range targets {
		m.RemoveClient(target.id, target.conn)
	}
}