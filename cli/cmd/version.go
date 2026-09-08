package cmd

import (
        "fmt"

        "github.com/spf13/cobra"
)

const appVersion = "0.1.0"

var shortFlag bool

// defines command 'version'
var versionCmd = &cobra.Command{
        Use:   "version",
        Short: "Show the current version of cmctl",
        Long:  `Shows detailed info about version and build of the ContainerMaster CLI`,
        Run: func(cmd *cobra.Command, args []string) {
            if shortFlag {
                // Se o usuário passou --short ou -s, imprime apenas o número
                fmt.Println(appVersion)
            } else {
                fmt.Printf("cmctl version %s\n", appVersion)
            }
        },
}

func init() {
        rootCmd.AddCommand(versionCmd)
        
        versionCmd.Flags().BoolVarP(&shortFlag, "short", "s", false, "Exibe apenas o número da versão")
}
