package storage

import (
	"database/sql"
	"fmt"
	"stock-market-data-pipeline/internal/model"
)

func SaveNotification(db *sql.DB, n model.NotificationPayload) error{
	query := `
		INSERT INTO notifications (user_id, alert_id, ticker, price_at_trigger, triggered_at)
		VALUES ($1, $2, $3, $4, $5)
	
	`
	_, err := db.Exec(
		query, 
		n.UserID, 
		n.AlertID, 
		n.Ticker, 
		n.PriceAtTrigger, 
		n.TriggeredAt,
	)
	if err != nil {
		return fmt.Errorf("failed to persist notification to database: %w", err)
	}
	
	return nil
}