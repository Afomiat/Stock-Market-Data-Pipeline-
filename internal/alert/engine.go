package alert

import (
	"database/sql"
	"encoding/json"
	"log"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/websocket"
	"time"
)

func CheckAndTriggerAlerts(db *sql.DB, wsManager *websocket.Manager, ticker string, currentPrice float64) {

	alerts, err := storage.GetActiveAlertByTicker(db, ticker)
	if err != nil{
		log.Printf("Alert Engine Error: Couldn't fetch alerts for %s: %v", ticker , err)
		return
	
	}

	if len(alerts) == 0{
		return
	}

	for _, alert := range alerts{
		isTriggered := false

		switch alert.Condition{
		case "above":
			if currentPrice >= alert.TargetPrice{
				isTriggered = true
			}
		case "below":
			if currentPrice <= alert.TargetPrice{
				isTriggered = true
			}
		default:
			log.Printf("Alert Engine Warning: Unknown condition type '%s' for alert ID %s ", alert.Condition, alert.ID)
			 continue
		}

		if isTriggered{
			
			err = storage.DeactivateAlert(db, alert.ID)
			if err != nil{
				log.Printf("Failed to auto-deactivate alert ID %s: %v", alert.ID, err)
			}
			log.Printf("ALERT TRIGGERED! User %s: %s has hit $%.2f(Target was %s $%.2f)", alert.UserID, alert.Ticker, currentPrice, alert.Condition, alert.TargetPrice)
		
			notification := model.NotificationPayload{
				UserID:         alert.UserID, 
				AlertID:        alert.ID,     
				Ticker:         alert.Ticker,
				PriceAtTrigger: currentPrice,
				TriggeredAt:    time.Now(),
			}

			messageBytes, err := json.Marshal(notification)
			if err != nil {
				log.Printf(" Failed to marshal notification struct: %v", err)
				continue
			}

			wsErr := wsManager.SendToUser(alert.UserID.String(), messageBytes)
			if wsErr != nil {
				log.Printf("User %s is offline. Falling back to PostgreSQL notification table...", alert.UserID)
				
				dbErr := storage.SaveNotification(db, notification)
				if dbErr != nil {
					log.Printf("Critical Error: Could not save offline notification: %v", dbErr)
				}
			} else {
				log.Printf("Live notification successfully streamed to user %s over WebSocket!", alert.UserID)
			}

			

		
	}

		
		

	}

	
}