package tests

import (
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/PhiloTFarnsworth/FantasySportsAF/server"
	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
	"github.com/PhiloTFarnsworth/FantasySportsAF/store/playerimport"
	"github.com/gin-gonic/gin"
	csrf "github.com/utrack/gin-csrf"
)

var r *gin.Engine

//Set up our test server and test database, add csrftoken path to create a client
func TestMain(m *testing.M) {

	//Setup for ServerSide Tests
	store.ConnectDB("testfsgo")
	db := store.GetDB()
	//create/clear testfsgo database
	//./store/cleaner.sql
	err := store.BatchSQLFromFile(os.Getenv("TableCleaner"), db)
	if err != nil {
		fmt.Println("league batch: ", err)
		os.Exit(1)
	}
	//./store/league.sql
	err = store.BatchSQLFromFile(os.Getenv("FSLSA"), db)
	if err != nil {
		fmt.Println("league batch: ", err)
		os.Exit(1)
	}
	//./store/user.sql
	err = store.BatchSQLFromFile(os.Getenv("FSUSA"), db)
	if err != nil {
		fmt.Println("user batch: ", err)
		os.Exit(1)
	}

	playerimport.Import("testfsgo")

	r = server.NewRouter()

	//Fake path to retrieve csrf token
	r.GET("csrftoken", func(c *gin.Context) { c.String(http.StatusOK, csrf.GetToken(c)) })

	os.Exit(m.Run())
}
