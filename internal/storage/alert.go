package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"stock-market-data-pipeline/internal/model"

	"github.com/google/uuid"
)

func CreateAlert(db *sql.DB, userID string, req model.CreateAlertRequest) (*model.Alert, error){
	query := `
		INSERT INTO alerts (user_id, ticker, target_price, condition )
		VALUES ($1, $2, $3, $4)
		RETURNING id , user_id, ticker, target_price, condition, is_active, created_at

	`
	var alert model.Alert

	err := db.QueryRow(query, userID, req.Ticker, req.TargetPrice, req.Condition).Scan(
		&alert.ID,
		&alert.UserID,
		&alert.Ticker,
		&alert.TargetPrice,
		&alert.Condition,
		&alert.IsActive,
		&alert.CreatedAt,
	)

	if err != nil{
		return nil, err
	}
	return &alert, nil
}

func GetAlertByUserID(db *sql.DB, userID string) ([]model.Alert, error){

	query := `
		SELECT id, user_id, ticker, target_price, condition, is_active, created_at
		FROM alerts
		WHERE user_id = $1
		ORDER BY created_at DESC	
	`
	rows, err := db.Query(query, userID)
	if err != nil{
		return nil, err
	}

	defer rows.Close()

	var alerts []model.Alert

	for rows.Next(){
		var alert model.Alert
		err := rows.Scan(
			&alert.ID,
			&alert.UserID,
			&alert.Ticker,
			&alert.TargetPrice,
			&alert.Condition,
			&alert.IsActive,
			&alert.CreatedAt,
		)
		if err != nil{
			return nil, err
		}
		alerts = append(alerts, alert)
	}

	if err = rows.Err(); err != nil{
		return nil, err
	}

	return  alerts, nil
}

func UpdateAlert(db *sql.DB, alertID string, userID string, req model.UpdateAlertRequest) (*model.Alert, error) {
	query := `
		UPDATE alerts
		SET 
			target_price = CASE WHEN $1 > 0 THEN $1 ELSE target_price END,
			condition = CASE WHEN $2 != '' THEN $2 ELSE condition END,
			is_active = $3
		WHERE id = $4 AND user_id = $5
		RETURNING id, user_id, ticker, target_price, condition, is_active, created_at
	`
	var alert model.Alert

	err := db.QueryRow(query, req.TargetPrice, req.Condition, req.IsActive, alertID, userID).Scan(
		&alert.ID,
		&alert.UserID,
		&alert.Ticker,
		&alert.TargetPrice,
		&alert.Condition,
		&alert.IsActive,
		&alert.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, errors.New("alert not found or unauthorized to modify")
	} else if err != nil {
		return nil, err
	}

	return &alert, nil
}

func DeleteAlert(db *sql.DB, alertID string, userID string) error {
	query := `DELETE FROM alerts WHERE id = $1 AND user_id = $2`

	result, err := db.Exec(query, alertID, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("alert not found or unauthorized to delete")
	}

	return nil
}

func GetActiveAlertByTicker(db *sql.DB, ticker string) ([]model.Alert, error){
	query := `
		SELECT 
				a.id, a.user_id, a.ticker, a.condition, a.target_price, a.is_active, 
				a.created_at, u.email
		FROM alerts a
		JOIN users u ON u.id = a.user_id
		WHERE a.ticker = $1 AND a.is_active = true
		FOR UPDATE;

	`
	rows, err := db.Query(query, ticker)

	if err != nil{
		return nil, fmt.Errorf("failed to query active alerts for %s: %w", ticker, err)
	}

	defer rows.Close()

	var alerts []model.Alert

	for rows.Next(){
		var alert model.Alert
		err := rows.Scan(
			&alert.ID,
			&alert.UserID,
			&alert.Ticker,
			&alert.Condition,
			&alert.TargetPrice,
			&alert.IsActive,
			&alert.CreatedAt,
			&alert.UserEmail,
		)

		if err != nil{
			return nil, fmt.Errorf("failed to scan alert row: %w", err)
		}
		alerts = append(alerts, alert)
	}
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error during alert rows iteration: %w", err)
	}

	return alerts, nil
}

func DeactivateAlert(db *sql.DB, alertID uuid.UUID) error{
	query := `UPDATE alerts SET is_active = false WHERE id = $1`
	_, err := db.Exec(query, alertID)
	return  err
}



