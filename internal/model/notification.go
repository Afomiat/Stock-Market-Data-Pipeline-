package model

import (
	"time"
	"github.com/google/uuid" 
)

type NotificationPayload struct {
	UserID         uuid.UUID `json:"user_id"`          
	AlertID        uuid.UUID `json:"alert_id"`        
	Ticker         string    `json:"ticker"`
	PriceAtTrigger float64   `json:"price_at_trigger"`
	TriggeredAt    time.Time `json:"triggered_at"`
	Message        string    `json:"message,omitempty"`
}