package storage

import (
	"database/sql"
	"errors"
	"fmt"
	"stock-market-data-pipeline/internal/model"

	"github.com/google/uuid"
)

var (
	ErrInsufficientFunds = errors.New("trade rejected: insufficient virtual cash reserves")
	ErrPositionNotFound  = errors.New("trade operation failed: target position not found or already closed")
)

func GetUserBalance(db *sql.DB, userID uuid.UUID) (float64, error) {

	if db == nil {
		return 0, fmt.Errorf("GetUserBalance: database connection context is nil")
	}

	var balance float64
	query := `SELECT balance FROM users WHERE id = $1`

	err := db.QueryRow(query, userID).Scan(&balance)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, fmt.Errorf("GetUserBalance for user %s: record not found: %w", userID, err)
		}
		return 0, fmt.Errorf("GetUserBalance failure for user %s on scanning row: %w", userID, err)
	}

	return balance, nil

}

func OpenPosition(db *sql.DB, userID uuid.UUID, req model.TradeRequest, entryPrice float64, totalCost float64)(*model.Position, error){
	if db == nil {
		return nil, fmt.Errorf("OpenPosition: database connection context is nil")
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, fmt.Errorf("OpenPosition: failed to initialize database transaction state: %w", err)
	}
	
	defer func(){
		_ = tx.Rollback()
	}()

	updateBalanceQuery := `
			UPDATE users
			SET balance = balance - $1
			WHERE id = $2 AND balance >= $1
	`

	res, err := tx.Exec(updateBalanceQuery, totalCost, userID)
	if err != nil {
		return nil, fmt.Errorf("OpenPosition: atomic cost balance modification query failed for user %s: %w", userID, err)
	}

	rowAffected, err := res.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("OpenPosition: failed to verify driver row allocation metrics: %w", err)
	}
	if rowAffected == 0 {
		return nil, fmt.Errorf("OpenPosition: validation abort for user %s: %w", userID, ErrInsufficientFunds)
	}

	insertPositionQuery := `
		INSERT INTO positions (user_id, ticker, side, quantity, entry_price, stop_loss, take_profit, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', NOW())
		RETURNING id, user_id, ticker, side, quantity, entry_price, stop_loss, take_profit, status, created_at
	`
	
	pos := &model.Position{}
	err = tx.QueryRow(
		insertPositionQuery, 
		userID, req.Ticker, req.TradeType, req.Volume, entryPrice, req.StopLoss, req.TakeProfit,
	).Scan(
		&pos.ID, &pos.UserID, &pos.Ticker, &pos.Side, &pos.Quantity, 
		&pos.EntryPrice, &pos.StopLoss, &pos.TakeProfit, &pos.Status, &pos.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("OpenPosition: failed execution or row parsing on position creation for ticker %s: %w", req.Ticker, err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("OpenPosition: transaction storage commitment block failed for user %s: %w", userID, err)
	}

	return pos, nil
}

func GetActivePositions(db *sql.DB, userID uuid.UUID) ([]model.Position, error) {
	if db == nil {
		return nil, fmt.Errorf("GetActivePositions: database connection context is nil")
	}

	query := `
		SELECT id, user_id, ticker, side, quantity, entry_price, stop_loss, take_profit, status, created_at
		FROM positions
		WHERE user_id = $1 AND status = 'OPEN'
		ORDER BY created_at DESC
	`
	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("GetActivePositions: query execution crash for user %s: %w", userID, err)
	}
	defer rows.Close()

	var positions []model.Position
	for rows.Next() {
		var p model.Position
		err := rows.Scan(
			&p.ID, &p.UserID, &p.Ticker, &p.Side, &p.Quantity,
			&p.EntryPrice, &p.StopLoss, &p.TakeProfit, &p.Status, &p.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("GetActivePositions: row parsing step failure encountered for user %s: %w", userID, err)
		}
		positions = append(positions, p)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("GetActivePositions: post-iteration dataset generation error loop for user %s: %w", userID, err)
	}

	return positions, nil
}

func ClosePosition(db *sql.DB, userID uuid.UUID, positionID uuid.UUID, exitPrice, payoutAmount float64) error { // 👈 Changed int to uuid.UUID
	if db == nil {
		return fmt.Errorf("ClosePosition: database connection context is nil")
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("ClosePosition: failed to open trade closure transaction state: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	closeQuery := `
		UPDATE positions
		SET status = 'CLOSED', exit_price = $1, closed_at = NOW()
		WHERE id = $2 AND user_id = $3 AND status = 'OPEN'
	`
	res, err := tx.Exec(closeQuery, exitPrice, positionID, userID)
	if err != nil {
		return fmt.Errorf("ClosePosition: structural status update query failure on position ID %s: %w", positionID, err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("ClosePosition: failed to verify position alteration rows verification metrics: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("ClosePosition: action denied on target ID %s for user %s: %w", positionID, userID, ErrPositionNotFound)
	}

	creditBalanceQuery := `
		UPDATE users
		SET balance = balance + $1
		WHERE id = $2
	`
	_, err = tx.Exec(creditBalanceQuery, payoutAmount, userID)
	if err != nil {
		return fmt.Errorf("ClosePosition: terminal credit injection crash for payout transfer targeting user %s: %w", userID, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("ClosePosition: fatal ledger transaction write closure failure on position %s: %w", positionID, err)
	}

	return nil
}

func GetTradeHistory(db *sql.DB, userID uuid.UUID) ([]model.Position, error) {
	if db == nil {
		return nil, fmt.Errorf("GetTradeHistory: database connection context is nil")
	}

	query := `
		SELECT id, user_id, ticker, side, quantity, entry_price, exit_price, stop_loss, take_profit, status, created_at, closed_at
		FROM positions
		WHERE user_id = $1 AND status = 'CLOSED'
		ORDER BY closed_at DESC
	`
	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("GetTradeHistory: query execution error for user %s: %w", userID, err)
	}
	defer rows.Close()

	var positions []model.Position
	for rows.Next() {
		var p model.Position
		err := rows.Scan(
			&p.ID, &p.UserID, &p.Ticker, &p.Side, &p.Quantity,
			&p.EntryPrice, &p.ExitPrice, &p.StopLoss, &p.TakeProfit, &p.Status, &p.CreatedAt, &p.ClosedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("GetTradeHistory: dataset parsing step interruption for user %s: %w", userID, err)
		}
		positions = append(positions, p)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("GetTradeHistory: post-scan iterative matrix verification crash for user %s: %w", userID, err)
	}

	return positions, nil
}

func GetPositionByID(db *sql.DB, positionID uuid.UUID) (*model.Position, error) { // 👈 Changed int to uuid.UUID
	if db == nil {
		return nil, fmt.Errorf("GetPositionByID: database connection context is nil")
	}

	query := `
		SELECT id, user_id, ticker, side, quantity, entry_price, status, created_at
		FROM positions
		WHERE id = $1
	`
	p := &model.Position{}
	err := db.QueryRow(query, positionID).Scan(
		&p.ID, &p.UserID, &p.Ticker, &p.Side, &p.Quantity, &p.EntryPrice, &p.Status, &p.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("GetPositionByID: targeted tracking entry ID %s doesn't exist: %w", positionID, err)
		}
		return nil, fmt.Errorf("GetPositionByID: data stream lookup failure for identity position %s: %w", positionID, err)
	}
	return p, nil
}