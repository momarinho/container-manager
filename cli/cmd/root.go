package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var ApiURL string

var rootCmd = &cobra.Command{
	Use: "cmctl",
	Short: "ContainerMaster CLI",
	Long: "A too in go for inspect, start and monitory containers.",
	Run: func(cmd *cobra.Command, args []string) {
		// if the user only run cmctl
		cmd.Help()	
	},
}

// execute teh public func called from main.go
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)

		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&ApiURL, "api-url", "u", "http://localhost:8000", "Base API URL of the application")
}
