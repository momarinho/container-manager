package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/spf13/cobra"
)

var startCmd = &cobra.Command{
	Use:   "start <container_id_or_name>",
	Short: "Start a stopped Docker container",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		containerTarget := args[0]

		cli, err := getDockerClient()
		if err != nil {
			fmt.Printf("❌ Error initializing Docker client: %v\n", err)
			return
		}
		defer cli.Close()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		fmt.Printf("▶️ Starting container %s...\n", containerTarget)

		err = cli.ContainerStart(ctx, containerTarget, container.StartOptions{})
		if err != nil {
			fmt.Printf("❌ Failed to start container: %v\n", err)
			return
		}

		fmt.Printf("✅ Container %s started successfully!\n", containerTarget)
	},
}

func init() {
	rootCmd.AddCommand(startCmd)
}
