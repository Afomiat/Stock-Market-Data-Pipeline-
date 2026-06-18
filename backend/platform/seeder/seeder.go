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
	for _, ticker := range tickers {
		var count int
		cutoff := time.Now().UTC().Add(-2 * time.Hour)
		
		db.QueryRow(`SELECT COUNT(*) FROM stock_prices WHERE ticker=$1 AND timestamp>=$2`,
			ticker, cutoff).Scan(&count)
		if count > 0 {
			log.Printf("📦 [Seeder] Ticker %s matches fresh sequence validation bounds, skipping.", ticker)
			continue
		}

		bars, err := fetchBars(ticker, "1h", "7d")
		if err != nil {
			log.Printf("📦 [Seeder] %s remote extraction failure: %v", ticker, err)
			continue
		}
		
		inserted := 0
		for _, b := range bars {
			ts := time.Unix(b.Time, 0).UTC()
			_, err := db.Exec(`
				INSERT INTO stock_prices (ticker, price, volume, timestamp)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT DO NOTHING
			`, ticker, b.Close, b.Volume, ts)
			if err == nil {
				inserted++
			}
		}
		log.Printf("📦 [Seeder] Successfully populated %s database array with %d elements.", ticker, inserted)
	}
	log.Println("📦 [Seeder] Synchronization lifecycle finalized.")
}