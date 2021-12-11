package store

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strings"

	"github.com/go-sql-driver/mysql"
)

var db *sql.DB

//slightly modified from the go.dev example.  We might want to utilize multiple databases, especially if we
//decide to use our database as a backing store for our websocket chat/draft implementation.
func ConnectDB(s string) {
	// Capture connection properties.
	cfg := mysql.Config{
		User:   os.Getenv("DBUSER"),
		Passwd: os.Getenv("DBPASS"),
		Net:    "tcp",
		Addr:   "127.0.0.1:3306",
		DBName: s,
	}
	// Get a database handle.
	var err error
	database, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal(err)
	}

	pingErr := database.Ping()
	if pingErr != nil {
		log.Fatal(pingErr)
	}
	fmt.Println("Database Connected!")
	db = database
}

func GetDB() *sql.DB {
	return db
}

//For testing purposes, we need a function that reads an .sql file and executes commands
//into a database.  This mimics the sql client statement SOURCE.
//https://stackoverflow.com/questions/38998267/how-to-execute-a-sql-file

//Note: This implementation relies on comments not triggering an error when executed
func BatchSQLFromFile(fileAddress string, db *sql.DB) error {
	rawSQL, err := ioutil.ReadFile(fileAddress)
	if err != nil {
		return err
	}
	statements := strings.Split(string(rawSQL), ";")
	for _, s := range statements {
		if strings.TrimSpace(s) != "" {
			_, err = db.Exec(s)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
