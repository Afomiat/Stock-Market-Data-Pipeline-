package model

import (
	"time"

	"github.com/google/uuid"
)

type Alert struct{
	ID uuid.UUID  `json:"id"`
	UserID uuid.UUID `json:"user_id"`
	Ticker    string    `json:"ticker"`
    TargetPrice     float64   `json:"target_price"`
	Condition   string    `json:"condition"`
    IsActive    bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	

}

type CreateAlertRequest struct{
	Ticker    string    `json:"ticker" binding:"required"`
  	TargetPrice float64 `json:"target_price" binding:"required"`
    Condition   string  `json:"condition" binding:"required,oneof=above below"`
}

type UpdateAlertRequest struct {
    TargetPrice float64 `json:"target_price"`
    Condition   string  `json:"condition" binding:"omitempty,oneof=above below"`
    IsActive    bool    `json:"is_active"`
}