package service

import (
	"database/sql"
	"errors"
	"fmt"
	"stock-market-data-pipeline/internal/model"
	"stock-market-data-pipeline/internal/storage"
	"stock-market-data-pipeline/platform/cache"

	"github.com/google/uuid"
)

type TradeService struct {
	db    *sql.DB
	cache *cache.RedisClient
}

func NewTradeService(db *sql.DB, rdb *cache.RedisClient) *TradeService {
	return &TradeService{
		db:    db,
		cache: rdb,
	}
}

func (ts *TradeService) calculateLiveSpread(marketPrice float64) (bid float64, ask float64) {
	spreadPercent := 0.0005
	spreadAmount := marketPrice * spreadPercent
	return marketPrice - (spreadAmount / 2), marketPrice + (spreadAmount / 2)
}

func (ts *TradeService) calculatePayout(side string, quantity, entryPrice, exitPrice float64) float64 {
	initialCost := quantity * entryPrice
	sharesCount := quantity * 100.0
	if side == "BUY" {
		return initialCost + ((exitPrice - entryPrice) * sharesCount)
	}
	return initialCost + ((entryPrice - exitPrice) * sharesCount)
}

func (ts *TradeService) ExecuteOpenPosition(userID uuid.UUID, req model.TradeRequest) (*model.PositionResponse, error) {
	marketPrice, err := ts.cache.GetPrice("live", req.Ticker)
	if err != nil {
		marketPrice, err = storage.GetLatestPrice(ts.db, req.Ticker)
		if err != nil {
			return nil, fmt.Errorf("ExecuteOpenPosition price fetch failure (cache & db miss): %w", err)
		}
	}

	bid, ask := ts.calculateLiveSpread(marketPrice)

	var executionPrice float64
	if req.TradeType == "BUY" {
		executionPrice = ask
	} else if req.TradeType == "SELL" {
		executionPrice = bid
	} else {
		return nil, errors.New("invalid trade side selection: must be 'BUY' or 'SELL'")
	}

	totalCost := req.Volume * executionPrice

	position, err := storage.OpenPosition(ts.db, userID, req, executionPrice, totalCost)
	if err != nil {
		return nil, err
	}

	newBalance, err := storage.GetUserBalance(ts.db, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch updated balance after trade: %w", err)
	}

	return &model.PositionResponse{
		Position:   *position,
		NewBalance: newBalance,
	}, nil
}

func (ts *TradeService) ExecuteClosePosition(userID uuid.UUID, positionID uuid.UUID) (float64, float64, error) { // 👈 Changed int to uuid.UUID
	pos, err := storage.GetPositionByID(ts.db, positionID)
	if err != nil {
		return 0, 0, err
	}

	if pos.Status != "OPEN" {
		return 0, 0, errors.New("execution denied: target position is already closed")
	}
	if pos.UserID != userID {
		return 0, 0, errors.New("authorization context conflict: record asset ownership violation")
	}

	marketPrice, err := ts.cache.GetPrice("live", pos.Ticker)
	if err != nil {
		marketPrice, err = storage.GetLatestPrice(ts.db, pos.Ticker)
		if err != nil {
			return 0, 0, fmt.Errorf("ExecuteClosePosition liquidation price fetch failed (cache & db miss): %w", err)
		}
	}

	bid, ask := ts.calculateLiveSpread(marketPrice)

	var exitPrice float64
	if pos.Side == "BUY" {
		exitPrice = bid
	} else {
		exitPrice = ask
	}

	payoutAmount := ts.calculatePayout(pos.Side, pos.Quantity, pos.EntryPrice, exitPrice) 

	err = storage.ClosePosition(ts.db, userID, positionID, exitPrice, payoutAmount)
	if err != nil {
		return 0, 0, err
	}

	newBalance, err := storage.GetUserBalance(ts.db, userID)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to fetch user balance after trade closure: %w", err)
	}

	var realizedPnL float64
	sharesCount := pos.Quantity * 100.0
	if pos.Side == "BUY" {
		realizedPnL = (exitPrice - pos.EntryPrice) * sharesCount
	} else {
		realizedPnL = (pos.EntryPrice - exitPrice) * sharesCount
	}

	return newBalance, realizedPnL, nil
}

func (ts *TradeService) ExecuteGetAccountSummary(userID uuid.UUID) (*model.AccountSummary, error){
	balance, err := storage.GetUserBalance(ts.db, userID)
	if err != nil {
		return nil, fmt.Errorf("ExecuteGetAccountSummary failed to get balance: %w", err)
	}

	positions, err := storage.GetActivePositions(ts.db, userID)
	if err != nil {
		return nil, fmt.Errorf("ExecuteGetAccountSummary failed to get active positions: %w", err)
	}

	var totalPortfolioValue float64

	for _, pos := range positions {
		livePrice, err := ts.cache.GetPrice("live", pos.Ticker)
		if err != nil {
			livePrice = pos.EntryPrice
		}

		positionValue := pos.Quantity * livePrice
		totalPortfolioValue += positionValue
	}

	return &model.AccountSummary{
		Balance:        balance,
		PortfolioValue: totalPortfolioValue,
		TotalEquity:    balance + totalPortfolioValue, 
	}, nil
}

func (ts *TradeService) ExecuteGetActivePositions(userID uuid.UUID) ([]model.Position, error) {
    return storage.GetActivePositions(ts.db, userID)
}

func (ts *TradeService) ExecuteGetTradeHistory(userID uuid.UUID) ([]model.Position, error) {
	return storage.GetTradeHistory(ts.db, userID)
}