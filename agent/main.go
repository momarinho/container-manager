package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

// ContainerMetric represents the telemetry payload for a single container.
type ContainerMetric struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	CPUPercent  float64   `json:"cpu_percent"`
	MemoryMB    float64   `json:"memory_mb"`
	MemoryLimit float64   `json:"memory_limit_mb"`
	CollectedAt time.Time `json:"collected_at"`
}

// DockerStats maps raw JSON stats from the Docker Engine API.
type DockerStats struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs     uint64 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage uint64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64 `json:"usage"`
		Limit uint64 `json:"limit"`
	} `json:"memory_stats"`
}

// MetricsHub coordinates live broadcasting and caching of container telemetry.
type MetricsHub struct {
	mu         sync.RWMutex
	latest     map[string]ContainerMetric
	clients    map[chan ContainerMetric]struct{}
	register   chan chan ContainerMetric
	unregister chan chan ContainerMetric
	broadcast  chan ContainerMetric
}

func newMetricsHub() *MetricsHub {
	return &MetricsHub{
		latest:     make(map[string]ContainerMetric),
		clients:    make(map[chan ContainerMetric]struct{}),
		register:   make(chan chan ContainerMetric),
		unregister: make(chan chan ContainerMetric),
		broadcast:  make(chan ContainerMetric, 64),
	}
}

// run coordinates client registrations and broadcasts to all active subscribers.
func (h *MetricsHub) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			h.mu.Lock()
			for ch := range h.clients {
				close(ch)
				delete(h.clients, ch)
			}
			h.mu.Unlock()
			return

		case ch := <-h.register:
			h.mu.Lock()
			h.clients[ch] = struct{}{}
			h.mu.Unlock()

		case ch := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[ch]; ok {
				delete(h.clients, ch)
				close(ch)
			}
			h.mu.Unlock()

		case metric := <-h.broadcast:
			h.mu.Lock()
			h.latest[metric.ID] = metric
			for ch := range h.clients {
				select {
				case ch <- metric:
				default:
					// Drop if client buffer is full to prevent lagging clients from stalling the hub
				}
			}
			h.mu.Unlock()
		}
	}
}

// getLatestSnapshot returns the most recent metrics for all monitored containers.
func (h *MetricsHub) getLatestSnapshot() []ContainerMetric {
	h.mu.RLock()
	defer h.mu.RUnlock()

	snapshot := make([]ContainerMetric, 0, len(h.latest))
	for _, m := range h.latest {
		snapshot = append(snapshot, m)
	}
	return snapshot
}

// calculateCPUPercent computes CPU usage percentage from consecutive Docker stats readings.
func calculateCPUPercent(stats *DockerStats) float64 {
	cpuDelta := float64(stats.CPUStats.CPUUsage.TotalUsage) - float64(stats.PreCPUStats.CPUUsage.TotalUsage)
	systemDelta := float64(stats.CPUStats.SystemCPUUsage) - float64(stats.PreCPUStats.SystemCPUUsage)

	if systemDelta > 0 && cpuDelta > 0 {
		onlineCPUs := float64(stats.CPUStats.OnlineCPUs)
		if onlineCPUs == 0 {
			onlineCPUs = 1.0
		}
		return (cpuDelta / systemDelta) * onlineCPUs * 100.0
	}
	return 0.0
}

// monitorContainer periodically queries Docker stats for a container in its own Goroutine.
func monitorContainer(ctx context.Context, cli *client.Client, id, name string, hub *MetricsHub) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	shortID := id
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			resp, err := cli.ContainerStatsOneShot(ctx, id)
			if err != nil {
				return
			}

			var rawStats DockerStats
			if err := json.NewDecoder(resp.Body).Decode(&rawStats); err != nil {
				resp.Body.Close()
				continue
			}
			resp.Body.Close()

			metric := ContainerMetric{
				ID:          shortID,
				Name:        name,
				CPUPercent:  calculateCPUPercent(&rawStats),
				MemoryMB:    float64(rawStats.MemoryStats.Usage) / (1024 * 1024),
				MemoryLimit: float64(rawStats.MemoryStats.Limit) / (1024 * 1024),
				CollectedAt: time.Now(),
			}

			select {
			case <-ctx.Done():
				return
			case hub.broadcast <- metric:
			}
		}
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	fmt.Printf("🚀 Starting ContainerMaster Metrics Agent on port :%s...\n", port)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to connect to Docker daemon: %v\n", err)
		os.Exit(1)
	}
	defer cli.Close()

	hub := newMetricsHub()
	go hub.run(ctx)

	// Discover existing running containers and spawn monitor workers
	containers, err := cli.ContainerList(ctx, container.ListOptions{All: false})
	if err != nil {
		fmt.Fprintf(os.Stderr, "❌ Failed to list containers: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("🔍 Discovered %d running containers. Launching parallel monitors...\n", len(containers))
	for _, c := range containers {
		containerName := strings.Join(c.Names, ", ")
		containerName = strings.TrimPrefix(containerName, "/")
		fmt.Printf("   • Spawning monitor worker for: %s (%s)\n", containerName, c.ID[:12])
		go monitorContainer(ctx, cli, c.ID, containerName, hub)
	}

	// HTTP Routes
	mux := http.NewServeMux()

	// 1. Healthcheck endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":  "ok",
			"service": "containermaster-metrics-agent",
			"time":    time.Now().UTC(),
		})
	})

	// 2. Snapshot endpoint: returns current latest state of all containers
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		snapshot := hub.getLatestSnapshot()
		json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"count":   len(snapshot),
			"data":    snapshot,
		})
	})

	// 3. Server-Sent Events (SSE) endpoint: real-time streaming to web/mobile clients
	mux.HandleFunc("/metrics/stream", func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		clientChan := make(chan ContainerMetric, 32)
		hub.register <- clientChan
		defer func() {
			hub.unregister <- clientChan
		}()

		fmt.Println("👤 Client connected to SSE telemetry stream")

		for {
			select {
			case <-r.Context().Done():
				fmt.Println("👋 Client disconnected from SSE telemetry stream")
				return
			case metric, open := <-clientChan:
				if !open {
					return
				}
				data, err := json.Marshal(metric)
				if err != nil {
					continue
				}
				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
			}
		}
	})

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	// Run HTTP server in a separate Goroutine
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "❌ HTTP server error: %v\n", err)
		}
	}()

	fmt.Printf("✅ Metrics Agent server listening on http://localhost:%s\n", port)
	fmt.Printf("   • Snapshot: http://localhost:%s/metrics\n", port)
	fmt.Printf("   • Stream:   http://localhost:%s/metrics/stream\n", port)

	// Wait for shutdown signal
	<-ctx.Done()
	fmt.Println("\n🛑 Gracefully shutting down Metrics Agent...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	server.Shutdown(shutdownCtx)
	fmt.Println("👋 Metrics Agent stopped successfully.")
}
