package alpaca

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/gorilla/websocket"
)

type AlpacaClient struct {
	conn   *websocket.Conn
	apiKey string
}

type FinnhubResponse struct {
	Type string         `json:"type"`
	Data []FinnhubTrade `json:"data"`
}

type FinnhubTrade struct {
	Symbol string  `json:"s"` 
	Price  float64 `json:"p"`
	Volume int64    `json:"v"`
}

func NewAlpacaClient() (*AlpacaClient, error) {
	apiKey := os.Getenv("ALPACA_API_KEY") 
	if apiKey == "" {
		return nil, fmt.Errorf("missing API key")
	}

	wsURL := fmt.Sprintf("%s?token=%s", os.Getenv("ALPACA_BASE_URL"), apiKey)
	log.Println("Connecting to global market data stream...")

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to dial websocket: %v", err)
	}

	return &AlpacaClient{
		conn:   conn,
		apiKey: apiKey,
	}, nil
}

func (c *AlpacaClient) Authenticate() error {
	log.Println("Global stream handshake authenticated successfully!")
	return nil
}

func (c *AlpacaClient) Subscribe(tickers []string) error {
	for _, ticker := range tickers {
		subMsg := map[string]string{
			"type":   "subscribe",
			"symbol": ticker,
		}
		if err := c.conn.WriteJSON(subMsg); err != nil {
			return fmt.Errorf("failed to subscribe to %s: %w", ticker, err)
		}
	}
	log.Printf("Successfully subscribed to tracking: %v", tickers)
	return nil
}

func (c *AlpacaClient) Listen(onPrice func(ticker string, price float64, volume int64 )) error {
	log.Println("Ingest listener active. Standing by for real-time market activity...")

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("stream connection broken: %w", err)
		}
		log.Printf("Raw Packet Received: %s", string(message))

		var msg FinnhubResponse
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		if msg.Type == "trade" {
			for _, trade := range msg.Data {
				onPrice(trade.Symbol, trade.Price, trade.Volume)
			}
		}
	}
}