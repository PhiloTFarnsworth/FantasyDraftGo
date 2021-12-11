package tests

import (
	"testing"

	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
)

//Let's start with an easy one.  We just want to be able to test that we can reach our test_simple
//database, and that we can query it's contents.
func TestExistence(t *testing.T) {
	store.ConnectDB("test_simple")
	db := store.GetDB()
	var got int64
	row := db.QueryRow("SELECT * FROM existence")
	if err := row.Scan(&got); err != nil {
		t.Fatal("Scan Error")
	}
	if got != 1 {
		t.Errorf("Got %v want 1", got)
	}
}
