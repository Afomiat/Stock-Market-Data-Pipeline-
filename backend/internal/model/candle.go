package model

import "time"

type OHLCVCandle struct{
	Timestamp time.Time  `json:"timestamp"`
	Open      float64    `json:"open"`
	High      float64    `json:"high"`
	Low       float64    `json:"low"`
	Close     float64    `json:"close"`
	Volume    float64    `json:"volume"`
}

