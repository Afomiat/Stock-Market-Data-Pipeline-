package alert

import (
	"database/sql"
	"encoding/json"
	"log"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/email"
	"stock-market-data-pipeline/platform/websocket"
	"sync"
	"time"
)

var processingAlerts sync.Map

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

			// Atomically claim this alert. If another goroutine is already handling
			// it (from a concurrent price tick), skip — DB deactivation is the real gate.
			_, alreadyProcessing := processingAlerts.LoadOrStore(alert.ID, true)
			if alreadyProcessing{
				continue
			}

			// Deactivate first — this is the single source of truth.
			// If this fails, release the in-memory lock so it can retry on the next tick.
			err = storage.DeactivateAlert(db, alert.ID)
			if err != nil{
				log.Printf("Failed to auto-deactivate alert ID %s: %v", alert.ID, err)
				processingAlerts.Delete(alert.ID) // allow retry on next tick
				continue
			}

			// Do NOT delete from processingAlerts on success — we intentionally keep
			// the entry so any concurrent ticks that arrive before the DB read catches
			// up are still blocked. The map is tiny and entries are per-alert-ID, so
			// this is safe for the lifetime of the process.
			log.Printf("ALERT TRIGGERED! User %s: %s has hit $%.2f (Target was %s $%.2f)", alert.UserID, alert.Ticker, currentPrice, alert.Condition, alert.TargetPrice)

			notification := model.NotificationPayload{
				Type:           "alert_triggered",
				UserID:         alert.UserID,
				AlertID:        alert.ID,
				Ticker:         alert.Ticker,
				PriceAtTrigger: currentPrice,
				TriggeredAt:    time.Now(),
			}

			messageBytes, err := json.Marshal(notification)
			if err != nil {
				log.Printf("Failed to marshal notification struct: %v", err)
				continue // lock stays held — alert is deactivated, no retry needed
			}

			// Always persist to DB so the notification history is complete
			if dbErr := storage.SaveNotification(db, notification); dbErr != nil {
				log.Printf("Warning: Could not persist notification to DB for alert %s: %v", alert.ID, dbErr)
			}

			// Also push live over WebSocket if user is online
			wsErr := wsManager.SendToUser(alert.UserID.String(), messageBytes)
			if wsErr != nil {
				log.Printf("User %s is offline — notification already saved to DB.", alert.UserID)
			} else {
				log.Printf("Live notification streamed to user %s over WebSocket!", alert.UserID)
			}

			go func(emailAddress string, payload model.NotificationPayload){
				err := email.SendAlertEmail(emailAddress, payload)
				if err != nil{
					log.Printf("Failed to send alert email to %s: %v", emailAddress, err)
				}else{
					log.Printf("Alert email dispatched to %s", emailAddress)
				}
			}(alert.UserEmail, notification)
		}
	}
}

