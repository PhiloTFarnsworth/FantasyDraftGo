package server

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	csrf "github.com/utrack/gin-csrf"
	"golang.org/x/crypto/bcrypt"
)

type NewAccount struct {
	Name     string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type LogAccount struct {
	Name     string `json:"username"`
	Password string `json:"password"`
}

//We'll be storing this info in the session to access the user's information.  Our int ID will allow us to find all the tables associated with the
//user, and we'll have the name string handy to publically identify the account.
type AccountInfo struct {
	ID    int64  `json:"id,string" form:"id,string"`
	Name  string `json:"name" form:"name"`
	Email string `json:"email" form:"email"`
}

func index(c *gin.Context) {
	//Whenever anyone hits the index, we want to verify they have a user id
	session := sessions.Default(c)
	var user AccountInfo
	if session.Get("userID") != nil {
		user.ID = session.Get("userID").(int64)
	}
	if session.Get("user") != nil {
		user.Name = session.Get("user").(string)
	}
	if session.Get("email") != nil {
		user.Email = session.Get("email").(string)
	}
	c.HTML(http.StatusOK, "index.html", gin.H{"user": user, "CSRFToken": csrf.GetToken(c)})
}

func login(c *gin.Context) {
	var a LogAccount
	session := sessions.Default(c)
	db := store.GetDB()
	if c.BindJSON(&a) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Something Went Wrong!", "ok": false})
		return
	}

	//We'll bind the JSON to LogAccount and then try to return the user entry from the database.  If that succeeds, we compare the entered
	//password to the hashed password in the database.
	var storedHash []byte
	var userID int64
	var email string
	if err := db.QueryRow("SELECT id, passhash, email FROM user WHERE name = ?", a.Name).Scan(&userID, &storedHash, &email); err != nil {
		//Name doesn't exist or other catastrophic error
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}
	//User exists, and we have the stored hash.
	if err := bcrypt.CompareHashAndPassword(storedHash, []byte(a.Password)); err != nil {
		//Password doesn't match
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	var userInfo AccountInfo
	userInfo.ID = userID
	userInfo.Name = a.Name
	userInfo.Email = email
	//With that, we can update the session
	session.Set("user", a.Name)
	session.Set("userID", userID)
	session.Set("email", email)
	session.Save()
	//fmt.Println(session.Get("user"))
	c.JSON(http.StatusOK, userInfo)
}

//logout clears our session's user data and return the user to index.
func logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Delete("user")
	session.Delete("userID")
	session.Delete("email")
	session.Save()
	c.Redirect(http.StatusFound, "/")
}

func register(c *gin.Context) {
	//So what do we do here?  Well, we want to take our information from post, do a little validation and then store it in
	//our database.  We also want to set our session to the new user's data and create a table for the user's leagues.
	var a NewAccount
	session := sessions.Default(c)
	db := store.GetDB()

	if c.BindJSON(&a) != nil {
		//JSON notification of bad values
		c.JSON(http.StatusBadRequest, gin.H{"error": "Malformed Request"})
		fmt.Println("Didn't assign values")
		return
	}
	//Validate username.  Make sure people can't pass an empty string.  Get rid of left and right side whitespace.
	validName := strings.TrimLeft(strings.TrimRight(a.Name, " "), " ")
	if validName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bad Username", "ok": false})
		return
	}

	//Validate email
	validator := strings.Split(a.Email, "@")
	if len(validator) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bad Email", "ok": false})
		fmt.Println("Bad Email")
		return
	}
	if len(strings.Split(validator[1], ".")) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bad Email", "ok": false})
		fmt.Println("Bad Email")
		return
	}

	//All good?  create pass hash
	passhash, err := bcrypt.GenerateFromPassword([]byte(a.Password), 10)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}
	//Start transaction
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad transaction", "ok": false})
		return
	}
	defer tx.Rollback()
	//Create user in database
	newAccount, err := tx.Exec("INSERT INTO user (name, passhash, email) VALUES (?,?,?)",
		validName,
		passhash,
		a.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		fmt.Println(err)
		fmt.Println("bad Insert")
		return
	}

	//Grab minted user's ID
	id, err := newAccount.LastInsertId()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		fmt.Println("bad id")
		return
	}

	var userInfo AccountInfo
	userInfo.ID = id
	userInfo.Name = validName
	userInfo.Email = a.Email
	//Should update their session to indicate their user.  If we were passing more information, we might consider
	//clearing the session keys, but at least for our cookie this is sufficient.
	session.Set("user", validName)
	session.Set("userID", id)
	session.Set("email", a.Email)
	session.Save()

	//Create User-league reference table
	refName := "leagues_" + strconv.FormatInt(id, 10)
	//Get rid of any weird tables I may or may not be littering the database with.
	_, err = tx.Exec("DROP TABLE IF EXISTS " + refName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err})
		fmt.Println("Bad drop table")
		return
	}
	_, err = tx.Exec("CREATE TABLE " + refName + " (league INT NOT NULL UNIQUE)")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err})
		fmt.Println("Bad create table")
		return
	}

	//Create invites table for user
	invitesName := "invites_" + strconv.FormatInt(id, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + invitesName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err})
		fmt.Println("Bad drop table")
		return
	}
	_, err = tx.Exec("CREATE TABLE " + invitesName + " (league INT NOT NULL UNIQUE)")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err})
		fmt.Println("Bad create table")
		return
	}

	//Check for outstanding invites
	rows, err := tx.Query("SELECT league FROM invites_0 WHERE email=?", a.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			//cool, we're done here
			if err = tx.Commit(); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			}
			c.JSON(http.StatusOK, userInfo)
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var leagueID int64
		if err = rows.Scan(&leagueID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		//We got their outstanding leagues, we need to insert those league ids into invites_userid
		//and the user ids into league_leagueid_invites
		_, err = tx.Exec("INSERT INTO invites_"+
			strconv.FormatInt(userInfo.ID, 10)+
			" (league) VALUES (?)", leagueID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		_, err = tx.Exec("INSERT INTO league_"+
			strconv.FormatInt(leagueID, 10)+
			"_invites (user) VALUES (?)", userInfo.ID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		//With that, we can delete the entry in the invits_0 table
		_, err = tx.Exec("DELETE FROM invites_0 WHERE email=? AND league=?", userInfo.Email, leagueID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		//Finally, we check if there are any more outstanding anonymous invites for the league.
		var anonCount int64
		row := tx.QueryRow("SELECT COUNT(*) FROM invites_0 WHERE league=?", leagueID)
		if err = row.Scan(&anonCount); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if anonCount == 0 {
			_, err = tx.Exec("DELETE FROM league_"+
				strconv.FormatInt(leagueID, 10)+
				"_invites WHERE user=?", 0)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
		}
	}

	//commit
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
	}
	//All that done, we want to pass the user id back as a json response
	c.JSON(http.StatusOK, userInfo)
}

func createLeague(c *gin.Context) {
	session := sessions.Default(c)
	db := store.GetDB()
	type LeagueInitSettings struct {
		MaxOwner   int64       `json:"maxOwner,string"`
		LeagueName string      `json:"league"`
		TeamName   string      `json:"name"`
		User       AccountInfo `json:"user"`
	}
	var s LeagueInitSettings
	if c.BindJSON(&s) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Malformed Request"})
		fmt.Println("Didn't assign values")
		return
	}

	fmt.Println(s.User.ID)
	fmt.Println(session.Get("userID").(int64))
	//A little validation here
	if s.User.ID != session.Get("userID").(int64) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Identity Crisis.  If you aren't mucking about with the client, log out and log back in."})
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad transaction", "ok": false})
		return
	}
	defer tx.Rollback()

	//So we haven't hit a problem yet.  Now we need to create a league for our user.
	newLeague, err := tx.Exec("INSERT INTO league (name, commissioner, maxOwner) VALUES (?,?,?)", s.LeagueName, s.User.ID, s.MaxOwner)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		fmt.Println(err)
		fmt.Println("bad Insert")
		return
	}

	leagueID, err := newLeague.LastInsertId()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		fmt.Println("bad id")
		return
	}

	//Now we need to create some League specific tables.  First off, we have the draft table.
	draftName := "draft_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + draftName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	_, err = tx.Exec("CREATE TABLE " + draftName + " (id INT AUTO_INCREMENT NOT NULL UNIQUE, player INT NOT NULL UNIQUE, team INT NOT NULL, primary key (`id`))")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//league roster table
	rosterName := "roster_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + rosterName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	_, err = tx.Exec("CREATE TABLE " + rosterName + " (player INT NOT NULL UNIQUE, active BOOL DEFAULT 0, team INT NOT NULL)")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//league transaction table
	transactionName := "transactions_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + transactionName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	_, err = tx.Exec("CREATE TABLE " + transactionName + " (id INT AUTO_INCREMENT NOT NULL UNIQUE, player INT NOT NULL, team INT NOT NULL, source INT NOT NULL, associated INT DEFAULT 0, initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP, primary key(`id`))")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//Team table
	teamTableName := "teams_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + teamTableName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	_, err = tx.Exec("CREATE TABLE " + teamTableName + " (id INT AUTO_INCREMENT NOT NULL UNIQUE, name VARCHAR(128) NOT NULL, manager INT NOT NULL, primary key(`id`))")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}
	//League Invites table
	leagueInvitesName := "league_" + strconv.FormatInt(leagueID, 10) + "_invites"
	_, err = tx.Exec("CREATE TABLE " + leagueInvitesName + " (user INT NOT NULL)")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//With Team Table created, we need to insert our first team.
	_, err = tx.Exec("INSERT INTO "+teamTableName+" (name, manager) VALUES (?, ?)", s.TeamName, s.User.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//With those set, we need to update the user's leagues table.
	userLeagues := "leagues_" + strconv.FormatInt(s.User.ID, 10)
	_, err = tx.Exec("INSERT INTO "+userLeagues+" (league) VALUES (?)", leagueID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//commit transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
	}

	//After all that, we will pass the league's ID back to the frontend, and then use that to request all our data.  It would be
	//more efficient to pass that information now, saving at least one query as well as the associated fetch, but for my sanity,
	//as well as for increased flexibility later (Such as custom logic for different types of fantasy leagues), we'll eat the hit.
	c.JSON(http.StatusOK, gin.H{"leagueID": leagueID})
}

//We'll make a request to /user/leagues/:id, and return any leagues on the leagues_#userID table.  We should also grab
//The associated name each league returned.  We should also return league invites to users with the same structure.
func getLeagues(c *gin.Context) {
	db := store.GetDB()
	type LeagueInfo struct {
		ID   int64
		Name string
	}
	var leagues []LeagueInfo
	var invites []LeagueInfo

	_, err := strconv.ParseInt(c.Param("id"), 10, 64)
	//check if number
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	userLeaguesTable := "leagues_" + c.Param("id")
	rows, err := db.Query("SELECT league.id, league.name FROM " +
		userLeaguesTable +
		" AS lt LEFT JOIN league ON lt.league=league.id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		//Cool, we're bringing back some rows
		if err = rows.Scan(&id, &name); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			return
		}
		leagues = append(leagues, LeagueInfo{ID: id, Name: name})
	}

	//Do the exact same thing, but with user invites table.
	userInvitesTable := "invites_" + c.Param("id")
	rows, err = db.Query("SELECT id, name FROM " +
		userInvitesTable +
		" AS lt LEFT JOIN league ON lt.league=league.id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var name string
		if err = rows.Scan(&id, &name); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			return
		}
		invites = append(invites, LeagueInfo{ID: id, Name: name})
	}

	c.JSON(http.StatusOK, gin.H{"leagues": leagues, "invites": invites})
}

//we'll take the id of the league and the user's credentials, ensure they're authorized to view, and then load the basic league
//data that will determine what lower components get rendered.
func LeagueHome(c *gin.Context) {
	db := store.GetDB()
	type FullLeagueInfo struct {
		ID           int64
		Name         string
		Commissioner AccountInfo
		State        string
		MaxOwner     int64
	}
	var f FullLeagueInfo
	var err error

	f.ID, err = strconv.ParseInt(c.Param("id"), 10, 64)
	//check if number
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//So let's start with some obvious stuff, we'll return
	row := db.QueryRow(`SELECT league.name, league.state, league.maxOwner,
		user.id, user.name, user.email FROM league JOIN user ON league.commissioner=user.id 
		WHERE league.id = ?`, c.Param("id"))
	if err := row.Scan(&f.Name, &f.State, &f.MaxOwner, &f.Commissioner.ID, &f.Commissioner.Name, &f.Commissioner.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	//What else do we need?  Well, we need a list of teams and the list of invites
	//Get teams

	type TeamInfo struct {
		ID      int64
		Name    string
		Manager AccountInfo
	}
	var teams []TeamInfo
	rows, err := db.Query("SELECT t.id, t.name, user.id, user.name, user.email FROM teams_" +
		strconv.FormatInt(f.ID, 10) +
		" AS t JOIN user ON t.manager=user.id")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	for rows.Next() {
		var t TeamInfo
		if err := rows.Scan(&t.ID, &t.Name, &t.Manager.ID, &t.Manager.Name, &t.Manager.Email); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			return
		}
		teams = append(teams, t)
	}
	//Get Invites (only if league is in INIT state)
	if f.State == "INIT" {
		var invites []AccountInfo
		rows, err = db.Query("SELECT user.id, user.name, user.email FROM league_" +
			strconv.FormatInt(f.ID, 10) +
			"_invites AS i JOIN user ON i.user=user.id")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var a AccountInfo
			if err := rows.Scan(&a.ID, &a.Name, &a.Email); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
				return
			}
			invites = append(invites, a)
		}

		rows, err = db.Query("SELECT email FROM invites_0 WHERE league=?", strconv.FormatInt(f.ID, 10))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			return
		}
		defer rows.Close()
		for rows.Next() {
			var a AccountInfo
			a.ID = 0
			if err := rows.Scan(&a.Email); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
				return
			}
			a.Name = a.Email
			invites = append(invites, a)
		}

		c.JSON(http.StatusOK, gin.H{"league": f, "teams": teams, "invites": invites})
		return
	}

	c.JSON(http.StatusOK, gin.H{"league": f, "teams": teams})
}

//Invite user will allow the commissioner to send invites to other users on the site, and probably eventually email unregistered
//users to join their league.  To accomplish this, we need to get user initiating the invite, the invitee's information and the
//league the invite points to.  We also need to verify the user making the request is the commissioner.
func InviteUser(c *gin.Context) {
	db := store.GetDB()
	type Invite struct {
		User    AccountInfo `json:"user" form:"user" binding:"required"`
		Invitee string      `json:"invitee" form:"invitee"`
		League  int64       `json:"league" form:"league"`
	}
	var v Invite
	if c.BindJSON(&v) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad bind", "ok": false})
		return
	}

	//So we got all that information.  Let's move forward with the assumption invitee is an email (username support to come later?)
	//Validate email, just in case something gets by the html validation.
	validator := strings.Split(v.Invitee, "@")
	if len(validator) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bad Email", "ok": false})
		fmt.Println("Bad Email")
		return
	}
	if len(strings.Split(validator[1], ".")) != 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bad Email", "ok": false})
		fmt.Println("Bad Email")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad transaction", "ok": false})
		return
	}
	defer tx.Rollback()

	//Email is legit, we can now search our user database for a user associated with this email.
	var userID int64
	var username string
	row := tx.QueryRow("SELECT id, name FROM user WHERE email=?", v.Invitee)
	//I really don't like putting functionality in errors, but here it'll save us a query.
	if err := row.Scan(&userID, &username); err != nil {

		//We need to check if for sql.error no rows.  If the email doesn't exist in the database, we need to send an email
		//to invite them to register to the site.  Otherwise, we take their ID and add an invite to their invite table.  When
		//the invitee checks their league invites, they can find a link to create a team and join the league.
		if err == sql.ErrNoRows {
			//Set userID to 0 for unregistered user
			userID = 0
			//See if an unregistered user has already been invited to league.  We use a singular 0 user value to indicate
			//that there exists unregistered users, then track them on the invites_0 table
			var exists int64
			subRow := tx.QueryRow("SELECT COUNT(user) FROM league_"+
				strconv.FormatInt(v.League, 10)+
				"_invites WHERE user=?", userID)
			if subErr := subRow.Scan(&exists); subErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": subErr.Error(), "ok": false})
				fmt.Println("league invites assert db error")
				return
			}

			//Exists will return zero or one, depending on whether there is already an anonymous user tracked.
			if exists == 0 {
				//add '0' user to league invites
				_, subErr := tx.Exec("INSERT INTO league_"+
					strconv.FormatInt(v.League, 10)+
					"_invites (user) VALUES (?)", userID)
				if subErr != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": subErr.Error(), "ok": false})
					fmt.Println("league invites insert db error")
					return
				}
			}

			//insert the invite into our unregistered user invites.
			_, subErr := tx.Exec("INSERT INTO invites_0 (league, email) VALUES (?,?)",
				v.League,
				v.Invitee)
			if subErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": subErr.Error(), "ok": false})
				fmt.Println("invites_0 db error")
				return
			}

			//TODO: SEND EMAIL TO GET USER TO REGISTER
			if subErr = tx.Commit(); subErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": subErr.Error(), "ok": false})
			}
			c.JSON(http.StatusOK, AccountInfo{ID: 0, Name: "Unregistered", Email: v.Invitee})
			return

		} else {
			//Any other scan error
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			fmt.Println("didn't scan")
			return
		}
	}

	//With a user ID, we can submit that into the league_#_invites as well as to the user's league invites.
	_, err = tx.Exec("INSERT INTO league_"+
		strconv.FormatInt(v.League, 10)+
		"_invites (user) VALUES (?)", userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		fmt.Println("league invites db error")
		return
	}

	_, err = tx.Exec("INSERT INTO invites_"+
		strconv.FormatInt(userID, 10)+
		" (league) VALUES (?)", v.League)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		fmt.Println("user invites db error")
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
	}

	c.JSON(http.StatusOK, AccountInfo{ID: userID, Name: username, Email: v.Invitee})
}

//join league will take a post request of a user's credentials and their desired league, check whether the league is already
//at capacity and whether the user is on the invitation list to the league. If so, We register them with the league.  We'll
//then reroute the user on the front-end to LeagueHome
func joinLeague(c *gin.Context) {
	db := store.GetDB()
	type TeamSubmission struct {
		User   int64  `json:"user,string"`
		League int64  `json:"league,string"`
		Team   string `json:"team"`
	}
	var t TeamSubmission
	if c.BindJSON(&t) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad bind", "ok": false})
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad transaction", "ok": false})
		return
	}
	defer tx.Rollback()

	//Check leagues for maxOwner
	var maxOwners int64
	row := tx.QueryRow("SELECT maxOwner FROM league WHERE id=?", t.League)
	if err := row.Scan(&maxOwners); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	var ownerCount int64
	row = tx.QueryRow("SELECT COUNT(*) FROM teams_" + strconv.FormatInt(t.League, 10))
	if err := row.Scan(&ownerCount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}
	//Check if we've already got a full league (This should only happen if a gm invites all slots then shrinks the league)
	if ownerCount >= maxOwners {
		c.JSON(http.StatusBadRequest,
			gin.H{"error": "Max teams in league reached.  Contact commissioner to increase team cap",
				"ok": false})
		return
	}

	//With that done, we can add the team to the league
	_, err = tx.Exec("INSERT INTO teams_"+
		strconv.FormatInt(t.League, 10)+
		" (name, manager) VALUES (?,?)", t.Team, t.User)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad insert teams_", "ok": false})
		return
	}

	//And insert the league into leagues_userid
	_, err = tx.Exec("INSERT INTO leagues_"+
		strconv.FormatInt(t.User, 10)+
		" (league) VALUES (?)", t.League)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad insert leagues_", "ok": false})
		return
	}

	//We're not done yet though, remove the invite from both invites tables
	_, err = tx.Exec("DELETE FROM league_"+
		strconv.FormatInt(t.League, 10)+
		"_invites WHERE user=?", t.User)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad delete league_#_invites", "ok": false})
		return
	}

	_, err = tx.Exec("DELETE FROM invites_"+
		strconv.FormatInt(t.User, 10)+
		" WHERE league=?", t.League)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad delete invites", "ok": false})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
	}

	//With all that done, we can return a little thumbs up, and the component will update the league id.
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

//We need a path to change league settings.  Beyond allowing changing the number of users, we would want to see additional options,
//such as choosing the scoring rules of the league, Free agent/waiver rules, league name, trade rules.  For now, let's concentrate
//on changing team name and scoring rules.
func leagueSettings(c *gin.Context) {
	db := store.GetDB()
	type LeagueSettings struct {
		ID       int64  `json:"league"`
		Name     string `json:"name"`
		MaxOwner int64  `json:"maxOwner,string"`
		Kind     string `json:"kind"`
	}
	var s LeagueSettings
	session := sessions.Default(c)
	if c.BindJSON(&s) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad bind", "ok": false})
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad transaction", "ok": false})
		return
	}
	defer tx.Rollback()

	//A little verification that we're getting the request from the commissioner
	var commishID int64
	userID := session.Get("userID").(int64)
	row := tx.QueryRow("SELECT commissioner FROM league WHERE id=?", s.ID)
	if err := row.Scan(&commishID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	if userID != commishID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unauthorized Edit.", "ok": false})
		return
	}
	//Verify new maxOwner is >= current team total.
	var teamCount int64
	row = tx.QueryRow("SELECT COUNT(*) FROM teams_" + strconv.FormatInt(s.ID, 10))
	if err := row.Scan(&teamCount); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}
	if s.MaxOwner < teamCount {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Max owners less than current teams in league", "ok": false})
		return
	}

	//With that done, we can change the league values.
	_, err = tx.Exec("UPDATE league SET name=?, maxOwner=?, kind=? WHERE id=?", s.Name, s.MaxOwner, s.Kind, s.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
	}

	c.JSON(http.StatusOK, s)
}

//Probably should be a general state shifting function, but for now, let's just lock league.  State shouldn't
//effect settings, but there might be custom logic for the progression for our database like making the tables
//read-only at "COMPLETE"
func lockLeague(c *gin.Context) {
	db := store.GetDB()
	type LockLeagueBody struct {
		ID int64 `json:"league"`
	}
	var b LockLeagueBody
	if c.BindJSON(&b) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad bind", "ok": false})
		return
	}

	//With only a single command, I think we're fine to simply run as is instead of throwing it into a transaction
	_, err := db.Exec("UPDATE league SET state='DRAFT' WHERE id=?", b.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{"state": "DRAFT"})
}
