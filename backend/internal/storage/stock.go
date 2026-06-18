package storage

import (
	"database/sql"
	"fmt"
	"stock-market-data-pipeline/internal/model"
	"time"
)

func SaveStockPrice(db *sql.DB, ticker string, price float64, volume int64) error {
    query := `
        INSERT INTO stock_prices (ticker, price, volume)
        VALUES ($1, $2, $3)
    `
    _, err := db.Exec(query, ticker, price, volume)
    if err != nil {
        return fmt.Errorf("failed to insert market tick for %s: %w", ticker, err)
    }
    return nil
}

func GetLatestPrice(db *sql.DB, ticker string) (float64, error){

    var price float64

    query := `
        SELECT price
        FROM stock_prices
        WHERE ticker = $1
        ORDER BY timestamp DESC
        LIMIT 1;
    `
    err := db.QueryRow(query, ticker).Scan(&price)
    if err != nil{
        if err == sql.ErrNoRows{
            return 0, fmt.Errorf("no historical database recors found for ticker %s", ticker)
        }

        return 0, fmt.Errorf("database query err for %s: %w", ticker, err)
    }

    return price, nil
}

func GetStockHistory(db *sql.DB, ticker string, interval string, startTime time.Time) ([]model.OHLCVCandle, error){

    query := `
            SELECT
                    time_bucket($1, timestamp) AS bucket,
                    first(price, timestamp) AS open,
                    MAX(price) AS high, 
                    MIN(price) AS low,
                    last(price, timestamp) AS close,
                    SUM(volume) AS volume
            FROM stock_prices
            WHERE ticker = $2 AND timestamp >= $3
            GROUP BY bucket
            ORDER BY bucket ASC;
    `

    rows, err := db.Query(query, interval, ticker, startTime)
    if err != nil {
		return nil, fmt.Errorf("failed to fetch timeseries aggregations from database: %w", err)
	}
	defer rows.Close()
    
    var candles []model.OHLCVCandle

    for rows.Next(){
        var c model.OHLCVCandle
        err := rows.Scan(&c.Timestamp, &c.Open, &c.High, &c.Low, &c.Close, &c.Volume)
        if err != nil{
            return nil, fmt.Errorf("failed to scan aggregated row data: %w", err)
        }
        candles = append(candles, c)
    }

    if err = rows.Err(); err != nil{
        return nil, fmt.Errorf("error during row iterations: %w", err)
	}

	return candles, nil
}

func GetTodayOpenPrice(db *sql.DB, ticker string) (float64, error){
    now := time.Now().UTC()

    todayMidnight := time.Date(now.Year(), now.Month(), now.Day(), 0,0,0,0, time.UTC)

    query := `
            SELECT first(price, timestamp)
            FROM stock_prices
            WHERE ticker = $1 AND timestamp >= $2;
    `

    var openPrice float64
    err := db.QueryRow(query, ticker, todayMidnight).Scan(&openPrice)
    if err != nil{
        return 0, err
    }

    return openPrice, nil
}

func GetLatestVolume(db *sql.DB, ticker string) (int64, error) {
    var volume int64
    query := `
            SELECT volume FROM stock_prices
            WHERE ticker = $1
            ORDER BY timestamp DESC
            LIMIT 1;
    `
    err := db.QueryRow(query, ticker).Scan(&volume)
    if err != nil{
        return 0, err
    }
    
    return volume, nil
}