package websocket

import (
	"fmt"
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