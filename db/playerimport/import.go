package main

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-sql-driver/mysql"
)

var db *sql.DB

func main() {
	// Capture connection properties.
	cfg := mysql.Config{
		User:   os.Getenv("DBUSER"),
		Passwd: os.Getenv("DBPASS"),
		Net:    "tcp",
		Addr:   "127.0.0.1:3306",
		DBName: "FantasyDraftGo",
	}
	// Get a database handle.
	var err error
	db, err = sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal(err)
	}

	pingErr := db.Ping()
	if pingErr != nil {
		log.Fatal(pingErr)
	}
	fmt.Println("Connected!")

	//After the heavy lifting of copy and pasting the above, we need to open nfl_2020.csv and then pass it into our database.
	dir, err := filepath.Abs("")
	if err != nil {
		panic(err)
	}
	f, err := os.Open(filepath.Join(dir, "nfl_2020.csv"))
	if err != nil {
		panic(err)
	}
	r := csv.NewReader(f)
	for {
		player, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Fatal(err)
		}
		if player[0] == "Rk" {
			continue
		}

		names := strings.Split(player[1], "\\")
		position := player[3]
		if position == "" {
			position = "WR"
		}

		result, err := db.Exec("INSERT INTO player (name, pfbr_name, team, position, age, games, starts, pass_completions, pass_attempts, pass_yards, pass_touchdowns, pass_interceptions, rush_attempts, rush_yards, rush_touchdowns, targets, receptions, receiving_yards, receiving_touchdowns, fumbles, fumbles_lost, all_touchdowns, two_point_conversion, two_point_pass, fantasy_points, point_per_reception, value_based) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
			strings.TrimRight(names[0], "*+ "),
			names[1],
			player[2],
			position,
			player[4],
			Normalize(player[5]),
			Normalize(player[6]),
			Normalize(player[7]),
			Normalize(player[8]),
			Normalize(player[9]),
			Normalize(player[10]),
			Normalize(player[11]),
			Normalize(player[12]),
			Normalize(player[13]),
			Normalize(player[15]),
			Normalize(player[16]),
			Normalize(player[17]),
			Normalize(player[18]),
			Normalize(player[20]),
			Normalize(player[21]),
			Normalize(player[22]),
			Normalize(player[23]),
			Normalize(player[24]),
			Normalize(player[25]),
			Normalize(player[26]),
			Normalize(player[27]),
			Normalize(player[30]))
		if err != nil {
			fmt.Print(err)
			panic(err)
		}

		id, err := result.LastInsertId()
		if err != nil {
			panic(err)
		}
		fmt.Println(id)
	}
}

func Normalize(value string) string {
	if value == "" {
		return "0"
	}
	return value
}
