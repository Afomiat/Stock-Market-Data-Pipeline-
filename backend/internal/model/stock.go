package model

import(
	"time"
	"github.com/google/uuid"
)

type StockPrice struct {
    ID        uuid.UUID `json:"id"`
    Ticker    string    `json:"ticker"`
    Price     float64   `json:"price"`
    Volume    int64     `json:"volume"`
    Timestamp time.Time `json:"timestamp"`
}



type StockPriceResponse struct {
	Ticker        string    `json:"ticker"`
	Price         float64   `json:"price"`
	Volume        int64     `json:"volume"`
	Timestamp     time.Time `json:"timestamp"`
	Change        float64   `json:"change"`         
	ChangePercent float64   `json:"change_percent"` 
}
