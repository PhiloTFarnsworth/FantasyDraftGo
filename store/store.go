package store

import (
	"database/sql"
	"fmt"
	"log"
	"os"

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
