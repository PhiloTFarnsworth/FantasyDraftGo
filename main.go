package main

import (
	"flag"
	"fmt"

	"github.com/PhiloTFarnsworth/FantasySportsAF/server"
	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
)

var testDB = flag.Bool("test", false, "Set database to testing, possibly do other testing related stuff.")

func main() {
	flag.Parse()
	if testing := *testDB; testing {
		//Setup for ServerSide Tests
		store.ConnectDB("testfsgo")
		fmt.Println("Connected to test database")
	} else {
		store.ConnectDB("fsgo")
	}

	server.Init()
}
