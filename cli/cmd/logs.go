package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/spf13/cobra"
)

var (
	followFlag     bool
	tailFlag       string
	timestampsFlag bool
)

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Fetch and stream logs of a Docker container",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		containerTarget := args[0]

		cli, err := getDockerClient()

		if err != nil {
			fmt.Println(err)
			return
		}

		defer cli.Close()

		var ctx context.Context
		var cancel context.CancelFunc

		if followFlag {
			ctx = context.Background()
		} else {
			ctx, cancel = context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
		}

		options := container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Follow:     followFlag,
			Timestamps: timestampsFlag,
			Tail:       tailFlag,
		}

		reader, err := cli.ContainerLogs(ctx, containerTarget, options)
		if err != nil {
			fmt.Println(err)
			return
		}
		defer reader.Close()

		inspect, err := cli.ContainerInspect(ctx, containerTarget)

		if err == nil && inspect.Config.Tty {
			io.Copy(os.Stdout, reader)
		} else {
			stdcopy.StdCopy(os.Stdout, os.Stderr, reader)
		}
	},
}

func init() {
	rootCmd.AddCommand(logsCmd)

	logsCmd.Flags().BoolVarP(&followFlag, "follow", "f", false, "Follow log output in real time")
	logsCmd.Flags().StringVarP(&tailFlag, "tail", "n", "all", "Number of lines to show from the end of the logs")
	logsCmd.Flags().BoolVarP(&timestampsFlag, "timestamps", "t", false, "Show timestamps in logs")
}
