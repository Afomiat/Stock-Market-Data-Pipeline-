package storage

import (
	"database/sql"
	"fmt"
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