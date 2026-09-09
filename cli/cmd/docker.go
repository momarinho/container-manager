package cmd

import "github.com/docker/docker/client"

// getDockerClient cria uma instância configurada do cliente Docker
func getDockerClient() (*client.Client, error) {
	return client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
}
