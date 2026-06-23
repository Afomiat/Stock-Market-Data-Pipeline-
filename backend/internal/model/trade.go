package model

import (
	"time"

	"github.com/google/uuid"
)

type Position struct {
	ID          uuid.UUID        `json:"id" db:"id"`
	UserID      uuid.UUID         `json:"user_id" db:"user_id"`
	Ticker      string     `json:"ticker" db:"ticker"`
	Side        string     `json:"trade_type" db:"side"` 
	Quantity    float64    `json:"volume" db:"quantity"`
	EntryPrice  float64    `json:"entry_price" db:"entry_price"`
	ExitPrice   *float64   `json:"exit_price,omitempty" db:"exit_price"`
	StopLoss    *float64   `json:"stop_loss,omitempty" db:"stop_loss"`
	TakeProfit  *float64   `json:"take_profit,omitempty" db:"take_profit"`
	Status      string     `json:"status" db:"status"` 
	CreatedAt   time.Time  `json:"entry_time" db:"created_at"`
	ClosedAt    *time.Time `json:"closed_at,omitempty" db:"closed_at"`
}

type TradeRequest struct {
	Ticker     string   `json:"ticker" binding:"required"`
	TradeType  string   `json:"trade_type" binding:"required"` 
	Volume     float64  `json:"volume" binding:"required,gt=0"`
	StopLoss   *float64 `json:"stop_loss,omitempty"`
	TakeProfit *float64 `json:"take_profit,omitempty"`
}

type AccountSummary struct {
	Balance        float64 `json:"balance"`
	PortfolioValue float64 `json:"portfolio_value"`
	TotalEquity    float64 `json:"total_equity"` // Balance + PortfolioValue
}

type PositionResponse struct {
	Position               
	NewBalance   float64    `json:"new_balance"`
}