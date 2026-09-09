package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/spf13/cobra"
)

var stopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop a container",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		containerTarget := args[0]

		cli, err := getDockerClient()
		if err != nil {
			fmt.Println(err)
			return
		}
		defer cli.Close()

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		fmt.Printf("	Stopping container %s...\n", containerTarget)

		err = cli.ContainerStop(ctx, containerTarget, container.StopOptions{})

		if err != nil {
			fmt.Println(err)
			return
		}

		fmt.Printf("	Container %s stopped successfully.\n", containerTarget)
	},
}

func init() {
	rootCmd.AddCommand(stopCmd)
}
