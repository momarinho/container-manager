# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY main.go ./

# Compile stripped static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /app/docker-proxy .

# Final minimal runtime stage
FROM alpine:3.20

RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /app/docker-proxy /app/docker-proxy

ENV PORT=2375
ENV DOCKER_SOCKET_PATH=/var/run/docker.sock
EXPOSE 2375

ENTRYPOINT ["/app/docker-proxy"]
