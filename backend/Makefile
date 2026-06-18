ifneq (,$(wildcard ./.env))
    include .env
    export
endif

migrate-create:
	migrate create -ext sql -dir internal/database/migration -seq $(name)

migrate-up:
	migrate -path internal/database/migration -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path internal/database/migration -database "$(DATABASE_URL)" down