package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

const appVersion = "0.1.0"

var shortFlag bool

// versionCmd defines the 'version' command
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show the current version of cmctl",
	Long:  "Shows detailed information about the version and build of ContainerMaster CLI.",
	Run: func(cmd *cobra.Command, args []string) {
		if shortFlag {
			// If the user passed --short or -s, print only the version number
			fmt.Println(appVersion)
		} else {
			fmt.Printf("cmctl version %s\n", appVersion)
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)

	versionCmd.Flags().BoolVarP(&shortFlag, "short", "s", false, "Display only the version number")
}
