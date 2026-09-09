package cmd

import (
	"testing"
)

func TestFormatVersion(t *testing.T) {
	tests := []struct {
		name     string
		short    bool
		expected string
	}{
		{
			name:     "returns full version string by default",
			short:    false,
			expected: "cmctl version 0.1.0",
		},
		{
			name:     "returns short version string when short is true",
			short:    true,
			expected: "0.1.0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatVersion(tt.short)

			if got != tt.expected {
				t.Errorf("formatVersion(%v) = %v, want %v", tt.short, got, tt.expected)
			}
		})
	}
}
