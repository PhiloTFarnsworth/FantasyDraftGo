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
		// db := store.GetDB()
		// //create/clear testfsgo database
		// //./store/league.sql
		// err := store.BatchSQLFromFile(os.Getenv("FSLSA"), db)
		// if err != nil {
		// 	fmt.Println("league batch: ", err)
		// 	os.Exit(1)
		// }
		// //./store/user.sql
		// err = store.BatchSQLFromFile(os.Getenv("FSUSA"), db)
		// if err != nil {
		// 	fmt.Println("user batch: ", err)
		// 	os.Exit(1)
		// }
		// playerimport.Import("testfsgo")
		fmt.Println("Connected to test database")
	} else {
		store.ConnectDB("fsgo")
	}

	server.Init()
}
