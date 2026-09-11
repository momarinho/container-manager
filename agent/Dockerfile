# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY main.go ./

# Build a stripped, statically-linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/metrics-agent .

# Final minimal runtime stage
FROM alpine:3.20

RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /app/metrics-agent /app/metrics-agent

ENV PORT=9090
EXPOSE 9090

ENTRYPOINT ["/app/metrics-agent"]
