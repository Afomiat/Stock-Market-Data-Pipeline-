FROM golang:1.25-alpine

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download


COPY . .

RUN go build -o main .

EXPOSE 8080

CMD ["./main"]