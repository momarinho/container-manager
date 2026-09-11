package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"syscall"
	"time"
)

// SecurityPolicy defines allowed Docker API capabilities based on environment configuration.
type SecurityPolicy struct {
	AllowContainers bool
	AllowImages     bool
	AllowNetworks   bool
	AllowVolumes    bool
	AllowExec       bool
	AllowInfo       bool
	AllowEvents     bool
	AllowPing       bool
	AllowVersion    bool
	AllowPost       bool
	AllowBuild      bool
	AllowSwarm      bool
}

// loadPolicyFromEnv loads policy settings from environment variables with safe defaults.
func loadPolicyFromEnv() *SecurityPolicy {
	getEnvBool := func(key string, defaultVal bool) bool {
		val := os.Getenv(key)
		if val == "" {
			return defaultVal
		}
		return val == "1" || strings.ToLower(val) == "true"
	}

	return &SecurityPolicy{
		AllowContainers: getEnvBool("CONTAINERS", true),
		AllowImages:     getEnvBool("IMAGES", true),
		AllowNetworks:   getEnvBool("NETWORKS", true),
		AllowVolumes:    getEnvBool("VOLUMES", true),
		AllowExec:       getEnvBool("EXEC", true),
		AllowInfo:       getEnvBool("INFO", true),
		AllowEvents:     getEnvBool("EVENTS", true),
		AllowPing:       getEnvBool("PING", true),
		AllowVersion:    getEnvBool("VERSION", true),
		AllowPost:       getEnvBool("POST", true),
		AllowBuild:      getEnvBool("BUILD", false),
		AllowSwarm:      getEnvBool("SWARM", false),
	}
}

// versionRegex matches Docker API version prefixes like /v1.43/ or /v1.40/
var versionRegex = regexp.MustCompile(`^/v\d+\.\d+/`)

// cleanPath strips the Docker API version prefix if present
func cleanPath(path string) string {
	cleaned := versionRegex.ReplaceAllString(path, "/")
	if !strings.HasPrefix(cleaned, "/") {
		cleaned = "/" + cleaned
	}
	return cleaned
}

// IsAllowed evaluates an incoming HTTP request against the security policy.
func (p *SecurityPolicy) IsAllowed(method, rawPath string) (bool, string) {
	path := cleanPath(rawPath)
	method = strings.ToUpper(method)

	// Disallow mutating methods if AllowPost is disabled
	if (method == http.MethodPost || method == http.MethodDelete || method == http.MethodPut) && !p.AllowPost {
		return false, "mutating HTTP methods are globally disabled"
	}

	// Always allow Ping & Version healthchecks
	if path == "/_ping" || path == "/ping" {
		if !p.AllowPing {
			return false, "ping endpoint is disabled"
		}
		return true, ""
	}

	if path == "/version" {
		if !p.AllowVersion {
			return false, "version endpoint is disabled"
		}
		return true, ""
	}

	if path == "/info" {
		if !p.AllowInfo {
			return false, "info endpoint is disabled"
		}
		return true, ""
	}

	if path == "/events" {
		if !p.AllowEvents {
			return false, "events endpoint is disabled"
		}
		return true, ""
	}

	if strings.HasPrefix(path, "/containers") {
		if !p.AllowContainers {
			return false, "containers endpoint is disabled"
		}
		return true, ""
	}

	if strings.HasPrefix(path, "/images") {
		if !p.AllowImages {
			return false, "images endpoint is disabled"
		}
		return true, ""
	}

	if strings.HasPrefix(path, "/networks") {
		if !p.AllowNetworks {
			return false, "networks endpoint is disabled"
		}
		return true, ""
	}

	if strings.HasPrefix(path, "/volumes") {
		if !p.AllowVolumes {
			return false, "volumes endpoint is disabled"
		}
		return true, ""
	}

	if strings.HasPrefix(path, "/exec") {
		if !p.AllowExec {
			return false, "exec endpoint is disabled"
		}
		return true, ""
	}

	if strings.HasPrefix(path, "/build") {
		if !p.AllowBuild {
			return false, "build endpoint is disabled"
		}
		return true, ""
	}

	if strings.HasPrefix(path, "/swarm") {
		if !p.AllowSwarm {
			return false, "swarm endpoint is disabled"
		}
		return true, ""
	}

	// Any unclassified endpoint is blocked by default (secure-by-default)
	return false, fmt.Sprintf("access to endpoint %s is not permitted by security policy", path)
}

// inspectContainerCreateBody checks if container creation attempts to use privileged flags
func inspectContainerCreateBody(body []byte) (bool, string) {
	if len(body) == 0 {
		return true, ""
	}

	var payload struct {
		HostConfig struct {
			Privileged bool `json:"Privileged"`
		} `json:"HostConfig"`
	}

	if err := json.Unmarshal(body, &payload); err == nil {
		if payload.HostConfig.Privileged {
			return false, "privileged containers are strictly forbidden"
		}
	}
	return true, ""
}

// createDockerReverseProxy configures the HTTP reverse proxy to the Unix Docker socket.
func createDockerReverseProxy(socketPath string) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = "http"
		req.URL.Host = "docker"
		// Clear remote address headers to avoid spoofing
		req.Header.Del("X-Forwarded-For")
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", socketPath)
		},
		DisableKeepAlives:     false,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &httputil.ReverseProxy{
		Director:  director,
		Transport: transport,
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]any{
				"error":   "Failed to communicate with Docker daemon",
				"details": err.Error(),
			})
		},
	}
}

// responseRecorder captures status code for access logging
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "2375"
	}

	socketPath := os.Getenv("DOCKER_SOCKET_PATH")
	if socketPath == "" {
		socketPath = "/var/run/docker.sock"
	}

	policy := loadPolicyFromEnv()
	proxy := createDockerReverseProxy(socketPath)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}

		// 1. Evaluate policy
		allowed, reason := policy.IsAllowed(r.Method, r.URL.Path)
		if !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]any{
				"error":  "Forbidden by ContainerMaster Security Policy",
				"reason": reason,
				"path":   r.URL.Path,
				"method": r.Method,
			})
			fmt.Printf("⛔ [403 FORBIDDEN] %-7s %s (Reason: %s)\n", r.Method, r.URL.Path, reason)
			return
		}

		// 2. Extra safety inspection for container creation
		if r.Method == http.MethodPost && cleanPath(r.URL.Path) == "/containers/create" {
			bodyBytes, err := io.ReadAll(r.Body)
			if err == nil {
				r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
				if safe, msg := inspectContainerCreateBody(bodyBytes); !safe {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusForbidden)
					json.NewEncoder(w).Encode(map[string]any{
						"error":  "Security Violation",
						"reason": msg,
					})
					fmt.Printf("🚨 [403 VIOLATION] Container creation blocked: %s\n", msg)
					return
				}
			}
		}

		// 3. Forward to Docker Unix Socket
		proxy.ServeHTTP(rec, r)
		duration := time.Since(start)

		fmt.Printf("✅ [%d] %-7s %s (%v)\n", rec.statusCode, r.Method, r.URL.Path, duration)
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  0, // 0 for persistent streaming (logs, exec)
		WriteTimeout: 0,
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	go func() {
		fmt.Printf("🛡️  ContainerMaster Security Socket Proxy running on :%s\n", port)
		fmt.Printf("   • Forwarding to: %s\n", socketPath)
		fmt.Printf("   • Security Policy: Containers=%v, Images=%v, Networks=%v, Volumes=%v, Exec=%v\n",
			policy.AllowContainers, policy.AllowImages, policy.AllowNetworks, policy.AllowVolumes, policy.AllowExec)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "❌ Proxy server error: %v\n", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	fmt.Println("\n🛑 Gracefully shutting down Docker Socket Proxy...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	server.Shutdown(shutdownCtx)
	fmt.Println("👋 Security Proxy stopped.")
}
