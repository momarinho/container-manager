package cmd

import (
        "encoding/json"
        "fmt"
        "net/http"
        "time"

        "github.com/spf13/cobra"
)

type HealthResponse struct {
	Success bool `json:"success"`
	Data 	struct {
		Status      string  `json:"status"`                                                                         
		Service     string  `json:"service"`                                                                        
		Environment string  `json:"environment"`                                                                    
		Version     string  `json:"version"`                                                                        
		Uptime      float64 `json:"uptime"`    
	} `json:"data"`
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check API health and connectivity",
	Run: func(cmd *cobra.Command, args []string) {
		url := fmt.Sprintf("%s/health", ApiURL)

		fmt.Printf("🔍 Checking API health at: %s...\n", url)

		client := &http.Client{Timeout: 5 * time.Second}

		resp, err := client.Get(url)
		if err != nil {
			fmt.Printf("❌ Failed to connect to the API: %v\n", err)
			fmt.Println("💡 Tip: Verify that the backend is running or pass --api-url with the correct address.")
			return
		}

		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			fmt.Printf("⚠️ The API responded with an unexpected status: %d\n", resp.StatusCode)
			return
		}

		var health HealthResponse
		if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
			fmt.Printf("❌ Error decoding JSON response: %v\n", err)
			return
		}

		fmt.Println("✅ API is online and healthy!")
		fmt.Printf("   • Service:     %s\n", health.Data.Service)
		fmt.Printf("   • Environment: %s\n", health.Data.Environment)
		fmt.Printf("   • API Version: %s\n", health.Data.Version)
		fmt.Printf("   • Uptime:      %.1f seconds\n", health.Data.Uptime)
	},
}

func init() {
	rootCmd.AddCommand(statusCmd)
}
