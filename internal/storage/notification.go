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

func GetNotificationsByUserID(db *sql.DB, userID string) ([]model.NotificationPayload, error){
	query := `
			SELECT user_id, alert_id, ticker, price_at_trigger, triggered_at
			FROM notificationS
			WHERE user_id = $1
			ORDER BY triggered_at DESC
	`

	rows, err := db.Query(query, userID)
	if err != nil{
		return nil, err
	}

	defer rows.Close()

	var notifications []model.NotificationPayload

	for rows.Next(){
		var n model.NotificationPayload
		err := rows.Scan(&n.UserID, &n.AlertID, &n.Ticker, &n.PriceAtTrigger, &n.TriggeredAt)
		
		if err != nil{
			return nil, err

		}
		notifications = append(notifications, n)
	
	}

	if err = rows.Err(); err != nil{
		return  nil, err
	}

	return notifications, nil
}