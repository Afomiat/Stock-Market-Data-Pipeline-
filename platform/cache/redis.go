package cache

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
	"crypto/tls"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

var ErrCacheMiss = fmt.Errorf("cache miss")


func (r *RedisClient) formatKey(ticker string) string{
	return fmt.Sprintf("price:%s", ticker)
}


func NewRedisClient() (*RedisClient, error){

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == ""{
		redisURL = "redis://localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil{
		return nil, fmt.Errorf("failed to parse redis url: %w", err)
	}

	if strings.HasPrefix(redisURL, "rediss://") {
		opt.TLSConfig = &tls.Config{
			InsecureSkipVerify: true, 
		}
	}

	rdb := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)

	defer cancel()

	err = rdb.Ping(ctx).Err()
	if err != nil{
		return nil, fmt.Errorf("could not connect to redis: %w", err)
	}

	return &RedisClient{client: rdb}, nil
}


func (r *RedisClient) GetPrice(ticker string) (float64, error){
	ctx := context.Background()
	key := r.formatKey(ticker)

	val, err := r.client.Get(ctx, key).Result()
	if err != nil{

		if err == redis.Nil{
			return  0, ErrCacheMiss
		}
		return 0, fmt.Errorf("failed to fetch price for %s from cache: %w", ticker, err) 
	}

	price, err := strconv.ParseFloat(val, 64)
	if err!= nil{
		return 0, fmt.Errorf("failed to parse cached price string '%s' to float64: %w", val, err)
	}

	return price, nil
}

func (r *RedisClient) SetPrice(ticker string, price float64) error{
	ctx := context.Background()
	key := r.formatKey(ticker)

	err := r.client.Set(ctx, key, price, time.Hour).Err()

	if err != nil {
		return fmt.Errorf("failed to cache price for %s: %w", ticker, err)
	}

	return nil 
}