package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
	"github.com/spf13/cobra"
)

var allContainers bool

var psCmd = &cobra.Command{
	Use:   "ps",
	Short: "List Docker containers on the host",
	Long:  `Connects to the Docker socket (/var/run/docker.sock) and lists containers.`,
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			fmt.Printf("❌ Error initializing Docker client: %v\n", err)
			return
		}
		defer cli.Close()

		containers, err := cli.ContainerList(ctx, container.ListOptions{All: allContainers})
		if err != nil {
			fmt.Printf("❌ Failed to list Docker containers: %v\n", err)
			fmt.Println("💡 Tip: Ensure the Docker daemon is running and your user has permission to access docker.sock.")
			return
		}

		if len(containers) == 0 {
			fmt.Println("No containers found.")
			return
		}

		// Tabwriter formats output into clean, aligned columns separated by '\t'
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
		fmt.Fprintln(w, "CONTAINER ID\tIMAGE\tCOMMAND\tSTATUS\tNAMES")

		for _, c := range containers {
			shortID := c.ID
			if len(shortID) > 12 {
				shortID = shortID[:12]
			}

			// In the Docker API, container names start with a slash (e.g., "/web")
			name := strings.Join(c.Names, ", ")
			name = strings.TrimPrefix(name, "/")

			fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", shortID, c.Image, c.Command, c.Status, name)
		}

		w.Flush()
	},
}

func init() {
	rootCmd.AddCommand(psCmd)

	psCmd.Flags().BoolVarP(&allContainers, "all", "a", false, "Show all containers (default shows only running)")
}
