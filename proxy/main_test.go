package main

import (
	"net/http"
	"testing"
)

func TestCleanPath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/v1.43/containers/json", "/containers/json"},
		{"/v1.40/info", "/info"},
		{"/containers/json", "/containers/json"},
		{"/version", "/version"},
		{"/_ping", "/_ping"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := cleanPath(tt.input)
			if got != tt.expected {
				t.Errorf("cleanPath(%q) = %q; want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestSecurityPolicy(t *testing.T) {
	policy := &SecurityPolicy{
		AllowContainers: true,
		AllowImages:     true,
		AllowNetworks:   false,
		AllowVolumes:    false,
		AllowExec:       true,
		AllowInfo:       true,
		AllowPing:       true,
		AllowVersion:    true,
		AllowPost:       true,
		AllowBuild:      false,
		AllowSwarm:      false,
	}

	tests := []struct {
		name      string
		method    string
		path      string
		wantAllow bool
	}{
		{"allow ping", http.MethodGet, "/_ping", true},
		{"allow version with prefix", http.MethodGet, "/v1.43/version", true},
		{"allow containers list", http.MethodGet, "/v1.43/containers/json", true},
		{"allow container start", http.MethodPost, "/v1.43/containers/smoke/start", true},
		{"allow images list", http.MethodGet, "/images/json", true},
		{"deny networks when disabled", http.MethodGet, "/v1.43/networks", false},
		{"deny volumes when disabled", http.MethodGet, "/v1.43/volumes", false},
		{"deny build when disabled", http.MethodPost, "/build", false},
		{"deny swarm by default", http.MethodGet, "/swarm", false},
		{"deny unclassified endpoint", http.MethodGet, "/system/df", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			allowed, _ := policy.IsAllowed(tt.method, tt.path)
			if allowed != tt.wantAllow {
				t.Errorf("IsAllowed(%s, %s) = %v; want %v", tt.method, tt.path, allowed, tt.wantAllow)
			}
		})
	}
}

func TestInspectContainerCreateBody(t *testing.T) {
	privilegedJSON := []byte(`{"Image": "ubuntu", "HostConfig": {"Privileged": true}}`)
	safeJSON := []byte(`{"Image": "ubuntu", "HostConfig": {"Privileged": false}}`)

	safe, reason := inspectContainerCreateBody(privilegedJSON)
	if safe {
		t.Errorf("Expected privileged container creation to be blocked")
	}
	if reason == "" {
		t.Errorf("Expected reason for blocking privileged container")
	}

	safe, _ = inspectContainerCreateBody(safeJSON)
	if !safe {
		t.Errorf("Expected safe container creation to be allowed")
	}
}
