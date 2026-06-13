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