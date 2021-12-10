package main

import (
	"github.com/PhiloTFarnsworth/FantasySportsAF/server"
	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
)

func main() {
	store.ConnectDB("fsgo")
	server.Init()
}
