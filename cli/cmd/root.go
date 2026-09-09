package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var ApiURL string

var rootCmd = &cobra.Command{
	Use:   "cmctl",
	Short: "ContainerMaster CLI - Manage containers from the terminal",
	Long:  "A lightweight CLI in Go to inspect, start, and monitor containers.",
	Run: func(cmd *cobra.Command, args []string) {
		// If the user runs only cmctl without arguments, show help
		cmd.Help()
	},
}

// Execute is the entry point called from main.go
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&ApiURL, "api-url", "u", "http://localhost:8000", "Base API URL of the ContainerMaster service")
}
