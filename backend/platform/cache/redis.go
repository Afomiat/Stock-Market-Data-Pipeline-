package cache

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"
)

type RedisClient struct {
	restURL   string
	restToken string
	http      *http.Client
}

var ErrCacheMiss = fmt.Errorf("cache miss")

func (r *RedisClient) formatKey(prefix, ticker string) string {
	return fmt.Sprintf("%s:price:%s", prefix, ticker)
}

func NewRedisClient() (*RedisClient, error) {
	restURL := os.Getenv("UPSTASH_REDIS_REST_URL")
	restToken := os.Getenv("UPSTASH_REDIS_REST_TOKEN")

	if restURL == "" || restToken == "" {
		return nil, fmt.Errorf("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set")
	}

	client := &RedisClient{
		restURL:   restURL,
		restToken: restToken,
		http:      &http.Client{Timeout: 10 * time.Second},
	}

	result, err := client.do("PING")
	if err != nil {
		return nil, fmt.Errorf("could not connect to redis: %w", err)
	}
	fmt.Printf("Redis REST ping result: %v\n", result)

	return client, nil
}

func (r *RedisClient) do(args ...interface{}) (interface{}, error) {
	body, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", r.restURL, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+r.restToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Result interface{} `json:"result"`
		Error  string      `json:"error"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	if result.Error != "" {
		return nil, fmt.Errorf("redis error: %s", result.Error)
	}

	return result.Result, nil
}

func (r *RedisClient) GetPrice(prefix, ticker string) (float64, error) {
	key := r.formatKey(prefix, ticker)

	result, err := r.do("GET", key)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch price for %s from cache: %w", ticker, err)
	}

	if result == nil {
		return 0, ErrCacheMiss
	}

	str, ok := result.(string)
	if !ok {
		return 0, fmt.Errorf("unexpected result type from cache")
	}

	price, err := strconv.ParseFloat(str, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse cached price '%s': %w", str, err)
	}

	return price, nil
}

func (r *RedisClient) SetPrice(prefix, ticker string, price float64, ttlInSeconds int) error {
	key := r.formatKey(prefix, ticker)

	var err error
	if ttlInSeconds > 0 {
		_, err = r.do("SET", key, fmt.Sprintf("%f", price), "EX", ttlInSeconds)
	} else {
		_, err = r.do("SET", key, fmt.Sprintf("%f", price))
	}

	if err != nil {
		return fmt.Errorf("failed to cache price for %s: %w", ticker, err)
	}

	return nil
}