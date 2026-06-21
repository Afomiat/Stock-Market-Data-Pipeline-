package seeder

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type bar struct {
	Time   int64
	Close  float64
	Volume int64
}

type SeedConfig struct {
	Interval string
	Range    string
}

func fetchBars(ticker, interval, rangeVal string) ([]bar, error) {
	url := fmt.Sprintf(
		"https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=%s&range=%s",
		ticker, interval, rangeVal,
	)
	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Chart struct {
			Result []struct {
				Timestamp  []int64 `json:"timestamp"`
				Indicators struct {
					Quote []struct {
						Close  []float64 `json:"close"`
						Volume []int64   `json:"volume"`
					} `json:"quote"`
				} `json:"indicators"`
			} `json:"result"`
		} `json:"chart"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if len(result.Chart.Result) == 0 {
		return nil, fmt.Errorf("no data for %s", ticker)
	}
	
	r := result.Chart.Result[0]
	if len(r.Indicators.Quote) == 0 {
		return nil, fmt.Errorf("malformed quote object for %s", ticker)
	}
	q := r.Indicators.Quote[0]
	
	var bars []bar
	for i, ts := range r.Timestamp {
		if i >= len(q.Close) || q.Close[i] == 0 {
			continue
		}
		vol := int64(0)
		if i < len(q.Volume) {
			vol = q.Volume[i]
		}
		bars = append(bars, bar{Time: ts, Close: q.Close[i], Volume: vol})
	}
	return bars, nil
}

func SeedHistoricalData(db *sql.DB, tickers []string) {
	log.Println("📦 [Seeder] Initializing tracking space verification...")
	
	configs := []SeedConfig{
		{Interval: "5m", Range: "5d"},   
		{Interval: "1h", Range: "60d"},  
		{Interval: "1d", Range: "1y"},   
	}

	for _, config := range configs {
		for _, ticker := range tickers {
			var count int
			cutoff := time.Now().UTC().Add(-48 * time.Hour)
			
			db.QueryRow(`
				SELECT COUNT(*) FROM stock_prices 
				WHERE ticker=$1 AND timeframe=$2 AND timestamp>=$3
			`, ticker, config.Interval, cutoff).Scan(&count)
			
			if count > 0 {
				log.Printf("📦 [Seeder] %s (%s) matches fresh sequence validation, skipping.", ticker, config.Interval)
				continue
			}

			bars, err := fetchBars(ticker, config.Interval, config.Range)
			if err != nil {
				log.Printf("📦 [Seeder] %s (%s) extraction failure: %v", ticker, config.Interval, err)
				continue
			}
			
			inserted := 0
			for _, b := range bars {
				ts := time.Unix(b.Time, 0).UTC()
				
				_, err := db.Exec(`
					INSERT INTO stock_prices (ticker, price, volume, timestamp, timeframe)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (ticker, timestamp, timeframe) DO NOTHING
				`, ticker, b.Close, b.Volume, ts, config.Interval)
				
				if err == nil {
					inserted++
				}
			}
			log.Printf("📦 [Seeder] Populated %s (%s) tracking matrix with %d points.", ticker, config.Interval, inserted)
		}
	}
	log.Println("📦 [Seeder] Synchronization lifecycle finalized.")
}