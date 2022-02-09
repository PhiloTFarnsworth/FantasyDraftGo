package server

import (
	"database/sql"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
	"github.com/PhiloTFarnsworth/FantasySportsAF/store/scanners"
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
	ID    int64  `json:"ID" form:"ID"`
	Name  string `json:"name" form:"name"`
	Email string `json:"email" form:"email"`
}

func index(c *gin.Context) {
	//Whenever anyone hits the index, we want to verify they have a user ID
	session := sessions.Default(c)

	//Whenever I need to nuke the development database, uncomment this
	//playerimport.Import("fsgo")

	var user AccountInfo
	if session.Get("user") != nil {
		user.ID = session.Get("user").(int64)
		db := store.GetDB()
		row := db.QueryRow("SELECT email, name FROM user WHERE ID = ?", user.ID)
		if err := row.Scan(&user.Email, &user.Name); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "ok": false})
			return
		}
	}
	c.HTML(http.StatusOK, "index.html", gin.H{"user": user, "CSRFToken": csrf.GetToken(c)})
}

func login(c *gin.Context) {
	var a LogAccount
	session := sessions.Default(c)
	db := store.GetDB()
	if err := c.BindJSON(&a); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Something Went Wrong!", "ok": false})
		return
	}

	//We'll bind the JSON to LogAccount and then try to return the user entry from the database.  If that succeeds, we compare the entered
	//password to the hashed password in the database.
	var storedHash []byte
	var userID int64
	var email string
	if err := db.QueryRow("SELECT ID, passhash, email FROM user WHERE name = ?", a.Name).Scan(&userID, &storedHash, &email); err != nil {
		//Name doesn't exist or other catastrophic error
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//User exists, and we have the stored hash.
	if err := bcrypt.CompareHashAndPassword(storedHash, []byte(a.Password)); err != nil {
		//Password doesn't match
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	var userInfo AccountInfo
	userInfo.ID = userID
	userInfo.Name = a.Name
	userInfo.Email = email
	//With that, we can update the session
	session.Set("user", userID)
	session.Save()
	//fmt.Println(session.Get("user"))
	c.JSON(http.StatusOK, userInfo)
}

//logout clears our session's user data and return the user to index.
func logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Delete("user")
	session.Save()
	c.Redirect(http.StatusFound, "/")
}

func register(c *gin.Context) {
	//So what do we do here?  Well, we want to take our information from post, do a little validation and then store it in
	//our database.  We also want to set our session to the new user's data and create a table for the user's leagues.
	var a NewAccount
	session := sessions.Default(c)
	db := store.GetDB()

	if err := c.BindJSON(&a); err != nil {
		fmt.Println(err)
		//JSON notification of bad values
		c.JSON(http.StatusBadRequest, gin.H{"error": "Malformed Request"})
		fmt.Println("Didn't assign values")
		return
	}
	//Validate username.  Make sure people can't pass an empty string.  Get rid of left and right side whitespace.
	validName := strings.TrimLeft(strings.TrimRight(a.Name, " "), " ")
	if validName == "" {
		c.JSON(http.StatusBadRequest, "Bad Username")
		return
	}

	//Validate email
	validator := strings.Split(a.Email, "@")
	if len(validator) != 2 {
		c.JSON(http.StatusBadRequest, "Bad Email")
		return
	}
	if len(strings.Split(validator[1], ".")) != 2 {
		c.JSON(http.StatusBadRequest, "Bad Email")
		return
	}

	//All good?  create pass hash
	passhash, err := bcrypt.GenerateFromPassword([]byte(a.Password), 10)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//Start transaction
	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer tx.Rollback()
	//Create user in database
	newAccount, err := tx.Exec("INSERT INTO user (name, passhash, email) VALUES (?,?,?)",
		validName,
		passhash,
		a.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	var userInfo AccountInfo
	//Grab minted user's ID
	userInfo.ID, err = newAccount.LastInsertId()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	userInfo.Name = validName
	userInfo.Email = a.Email

	//Should update their session to indicate their user.  If we were passing more information, we might consider
	//clearing the session keys, but at least for our cookie this is sufficient.
	session.Set("user", userInfo.ID)
	session.Save()

	//Create User-league reference table
	refName := "leagues_" + strconv.FormatInt(userInfo.ID, 10)
	//Get rid of any weird tables I may or may not be littering the database with.
	_, err = tx.Exec("DROP TABLE IF EXISTS " + refName)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	_, err = tx.Exec("CREATE TABLE " + refName + " (league INT NOT NULL UNIQUE)")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//Create invites table for user
	invitesName := "invites_" + strconv.FormatInt(userInfo.ID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + invitesName)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	_, err = tx.Exec("CREATE TABLE " + invitesName + " (league INT NOT NULL UNIQUE)")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//Check for outstanding invites
	var inviteCount int64
	row := tx.QueryRow("SELECT COUNT(*) FROM invites_0 WHERE email=?", userInfo.Email)
	if err = row.Scan(&inviteCount); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//No invites, commit transactions and return userinfo.
	if inviteCount == 0 {
		if err = tx.Commit(); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		c.JSON(http.StatusOK, userInfo)
		return
	}

	//We were getting a funny error from using the tx syntax while accessing these invites.  If you add another transaction
	//while in the for rows.Next(), you'll overload the connection which will result in the transaction failing due to busy buffer.
	//It took me a couple hours and a nap, but instead we grab the rows, allow rows.close to call after rows.next, then resume our
	//transactions using a list of league ids returned.
	var leagues []int64
	rows, err := tx.Query("SELECT league FROM invites_0 WHERE email=?", userInfo.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		var leagueID int64
		if err = rows.Scan(&leagueID); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		leagues = append(leagues, leagueID)
	}

	for i := 0; i < len(leagues); i++ {
		//We got their outstanding leagues, we need to insert those league ids into invites_userid
		//and the user ids into league_leagueid_invites
		_, err = tx.Exec("INSERT INTO invites_"+
			strconv.FormatInt(userInfo.ID, 10)+
			" (league) VALUES (?)", leagues[i])
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		_, err = tx.Exec("INSERT INTO league_"+
			strconv.FormatInt(leagues[i], 10)+
			"_invites (user) VALUES (?)", userInfo.ID)
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}

		//With that, we can delete the entry in the invits_0 table
		_, err = tx.Exec("DELETE FROM invites_0 WHERE email=? AND league=?", userInfo.Email, leagues[i])
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}

		//Finally, we check if there are any more outstanding anonymous invites for the league.
		var anonCount int64
		row := tx.QueryRow("SELECT COUNT(*) FROM invites_0 WHERE league=?", leagues[i])
		if err = row.Scan(&anonCount); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}

		if anonCount == 0 {
			_, err = tx.Exec("DELETE FROM league_"+
				strconv.FormatInt(leagues[i], 10)+
				"_invites WHERE user=?", 0)
			if err != nil {
				c.JSON(http.StatusBadRequest, err.Error())
				return
			}
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//All that done, we want to pass the user ID back as a json response
	c.JSON(http.StatusOK, userInfo)
}

func createLeague(c *gin.Context) {
	session := sessions.Default(c)
	db := store.GetDB()

	type LeagueInitSettings struct {
		MaxOwner   int64  `json:"maxOwner"`
		LeagueName string `json:"league"`
		TeamName   string `json:"team"`
	}

	var s LeagueInitSettings
	if err := c.BindJSON(&s); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, "Malformed Request")
		return
	}

	user := session.Get("user").(int64)

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer tx.Rollback()

	//So we haven't hit a problem yet.  Now we need to create a league for our user.
	newLeague, err := tx.Exec("INSERT INTO league (name, commissioner, maxOwner) VALUES (?,?,?)", s.LeagueName, user, s.MaxOwner)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	leagueID, err := newLeague.LastInsertId()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//With our ID, we can populate the league's position amongst the other settings tables.  While we
	//could have our users define the league better before creation, I'm split on whether it isn't just better
	//to expose all the customization options after the league has been created.  To be continued...
	_, err = tx.Exec("INSERT INTO draft_settings (ID) VALUES (?)", leagueID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("INSERT INTO positional_settings (ID) VALUES (?)", leagueID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("INSERT INTO scoring_settings_offense (ID) VALUES (?)", leagueID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("INSERT INTO scoring_settings_defense (ID) VALUES (?)", leagueID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("INSERT INTO scoring_settings_special (ID) VALUES (?)", leagueID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//Now we need to create some League specific tables.  First off, we have the draft table.
	draftName := "draft_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + draftName)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("CREATE TABLE " + draftName + " (ID INT NOT NULL UNIQUE, player INT NOT NULL UNIQUE, team INT NOT NULL, primary key (`ID`))")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//league roster table
	rosterName := "roster_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + rosterName)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("CREATE TABLE " + rosterName + " (player INT NOT NULL UNIQUE, active BOOL DEFAULT 0, team INT NOT NULL)")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//league transaction table
	transactionName := "transactions_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + transactionName)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("CREATE TABLE " + transactionName + " (ID INT AUTO_INCREMENT NOT NULL UNIQUE, player INT NOT NULL, team INT NOT NULL, source INT NOT NULL, associated INT DEFAULT 0, initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP, primary key(`ID`))")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//Team table
	teamTableName := "teams_" + strconv.FormatInt(leagueID, 10)
	_, err = tx.Exec("DROP TABLE IF EXISTS " + teamTableName)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("CREATE TABLE " + teamTableName + " (ID INT AUTO_INCREMENT NOT NULL UNIQUE, name VARCHAR(128) NOT NULL, manager INT NOT NULL, slot INT NOT NULL DEFAULT 0, primary key(`ID`))")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//League Invites table
	leagueInvitesName := "league_" + strconv.FormatInt(leagueID, 10) + "_invites"
	_, err = tx.Exec("DROP TABLE IF EXISTS " + leagueInvitesName)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	_, err = tx.Exec("CREATE TABLE " + leagueInvitesName + " (user INT NOT NULL)")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//With Team Table created, we need to insert our first team.
	_, err = tx.Exec("INSERT INTO "+teamTableName+" (name, manager) VALUES (?, ?)", s.TeamName, user)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//With those set, we need to update the user's leagues table.
	userLeagues := "leagues_" + strconv.FormatInt(user, 10)
	_, err = tx.Exec("INSERT INTO "+userLeagues+" (league) VALUES (?)", leagueID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//commit transaction
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}

	//After all that, we will pass the league's ID back to the frontend, and then use that to request all our data.  It would be
	//more efficient to pass that information now, saving at least one query as well as the associated fetch, but for my sanity,
	//as well as for increased flexibility later (Such as custom logic for different types of fantasy leagues), we'll eat the hit.
	c.JSON(http.StatusOK, gin.H{"leagueID": leagueID})
}

//We'll make a request to /user/leagues/:ID, and return any leagues on the leagues_#userID table.  We should also grab
//The associated name each league returned.  We should also return league invites to users with the same structure.
func getLeagues(c *gin.Context) {
	session := sessions.Default(c)
	db := store.GetDB()
	type LeagueInfo struct {
		ID           int64
		Name         string
		Commissioner string
	}
	var leagues []LeagueInfo
	var invites []LeagueInfo

	user := session.Get("user").(int64)

	userLeaguesTable := "leagues_" + strconv.FormatInt(user, 10)
	rows, err := db.Query("SELECT league.ID, league.name, user.name FROM " +
		userLeaguesTable +
		" AS lt INNER JOIN league ON lt.league=league.ID LEFT JOIN user ON league.commissioner=user.ID")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		var info LeagueInfo
		//Cool, we're bringing back some rows
		if err = rows.Scan(&info.ID, &info.Name, &info.Commissioner); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		leagues = append(leagues, info)
	}

	//Do the exact same thing, but with user invites table.
	userInvitesTable := "invites_" + strconv.FormatInt(user, 10)
	rows, err = db.Query("SELECT league.ID, league.name, user.name FROM " +
		userInvitesTable +
		" AS lt INNER JOIN league ON lt.league=league.ID LEFT JOIN user ON league.commissioner=user.ID")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		var info LeagueInfo
		if err = rows.Scan(&info.ID, &info.Name, &info.Commissioner); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		invites = append(invites, info)
	}

	c.JSON(http.StatusOK, gin.H{"leagues": leagues, "invites": invites})
}

//we'll take the ID of the league and the user's credentials, ensure they're authorized to view, and then load the basic league
//data that will determine what lower components get rendered.
func LeagueHome(c *gin.Context) {
	session := sessions.Default(c)
	db := store.GetDB()
	type FullLeagueInfo struct {
		ID           int64
		Name         string
		Commissioner AccountInfo
		State        string
		MaxOwner     int64
		Kind         string
	}
	var f FullLeagueInfo
	var err error
	user := session.Get("user").(int64)

	f.ID, err = strconv.ParseInt(c.Param("ID"), 10, 64)
	//check if number
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//So let's start with some obvious stuff, we'll return
	row := db.QueryRow(`SELECT league.name, league.state, league.maxOwner, league.kind,
		user.ID, user.name, user.email FROM league JOIN user ON league.commissioner=user.ID 
		WHERE league.ID = ?`, c.Param("ID"))
	if err := row.Scan(&f.Name, &f.State, &f.MaxOwner, &f.Kind, &f.Commissioner.ID, &f.Commissioner.Name, &f.Commissioner.Email); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//What else do we need?  Well, we need a list of teams and the list of invites
	//Get teams

	type TeamInfo struct {
		ID      int64
		Name    string
		Manager AccountInfo
		Slot    int64
	}
	var teams []TeamInfo
	rows, err := db.Query("SELECT t.ID, t.name, t.slot, user.ID, user.name, user.email FROM teams_" +
		strconv.FormatInt(f.ID, 10) +
		" AS t JOIN user ON t.manager=user.ID")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	for rows.Next() {
		var t TeamInfo
		if err := rows.Scan(&t.ID, &t.Name, &t.Slot, &t.Manager.ID, &t.Manager.Name, &t.Manager.Email); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		teams = append(teams, t)
	}
	//check for user amongst the teams.
	authorized := false
	for _, team := range teams {
		if team.Manager.ID == user {
			authorized = true
		}
	}
	if !authorized {
		c.JSON(http.StatusForbidden, "User not in league")
	}

	//Get Invites (only if league is in INIT state)
	if f.State == "INIT" {
		var invites []AccountInfo
		rows, err = db.Query("SELECT user.ID, user.name, user.email FROM league_" +
			strconv.FormatInt(f.ID, 10) +
			"_invites AS i JOIN user ON i.user=user.ID")
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		defer rows.Close()
		for rows.Next() {
			var a AccountInfo
			if err := rows.Scan(&a.ID, &a.Name, &a.Email); err != nil {
				c.JSON(http.StatusBadRequest, err.Error())
				return
			}
			invites = append(invites, a)
		}

		rows, err = db.Query("SELECT email FROM invites_0 WHERE league=?", strconv.FormatInt(f.ID, 10))
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		defer rows.Close()
		for rows.Next() {
			var a AccountInfo
			a.ID = 0
			if err := rows.Scan(&a.Email); err != nil {
				c.JSON(http.StatusBadRequest, err.Error())
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
	session := sessions.Default(c)
	db := store.GetDB()
	type Invite struct {
		Invitee string `json:"invitee" form:"invitee"`
		League  int64  `json:"league" form:"league"`
	}
	var v Invite
	if err := c.BindJSON(&v); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//Check that invite issuer is commissioner of the league
	user := session.Get("user").(int64)
	var commish int64
	row := db.QueryRow("SELECT commissioner FROM league WHERE ID=?", v.League)
	if err := row.Scan(&commish); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	if commish != user {
		c.JSON(http.StatusBadRequest, "Not Authorized to invite")
		return
	}

	//Validate email, just in case something gets by the html validation.
	validator := strings.Split(v.Invitee, "@")
	if len(validator) != 2 {
		c.JSON(http.StatusBadRequest, "Bad Email")
		return
	}
	if len(strings.Split(validator[1], ".")) < 2 {
		c.JSON(http.StatusBadRequest, "Bad Email")
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer tx.Rollback()

	//Email is legit, we can now search our user database for a user associated with this email.
	var userID int64
	var username string
	row = tx.QueryRow("SELECT ID, name FROM user WHERE email=?", v.Invitee)
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
				c.JSON(http.StatusBadRequest, subErr.Error())
				return
			}

			//Exists will return zero or one, depending on whether there is already an anonymous user tracked.
			if exists == 0 {
				//add '0' user to league invites
				_, subErr := tx.Exec("INSERT INTO league_"+
					strconv.FormatInt(v.League, 10)+
					"_invites (user) VALUES (?)", userID)
				if subErr != nil {
					c.JSON(http.StatusBadRequest, subErr.Error())
					fmt.Println("league invites insert db error")
					return
				}
			}

			//insert the invite into our unregistered user invites.
			_, subErr := tx.Exec("INSERT INTO invites_0 (league, email) VALUES (?,?)",
				v.League,
				v.Invitee)
			if subErr != nil {
				c.JSON(http.StatusBadRequest, subErr.Error())
				fmt.Println("invites_0 db error")
				return
			}

			//TODO: SEND EMAIL TO GET USER TO REGISTER
			if subErr = tx.Commit(); subErr != nil {
				c.JSON(http.StatusBadRequest, subErr.Error())
			}
			c.JSON(http.StatusOK, AccountInfo{ID: 0, Name: "Unregistered", Email: v.Invitee})
			return

		} else {
			//Any other scan error
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
	}

	//With a user ID, we can submit that into the league_#_invites as well as to the user's league invites.
	_, err = tx.Exec("INSERT INTO league_"+
		strconv.FormatInt(v.League, 10)+
		"_invites (user) VALUES (?)", userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		fmt.Println("league invites db error")
		return
	}

	_, err = tx.Exec("INSERT INTO invites_"+
		strconv.FormatInt(userID, 10)+
		" (league) VALUES (?)", v.League)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		fmt.Println("user invites db error")
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}

	c.JSON(http.StatusOK, AccountInfo{ID: userID, Name: username, Email: v.Invitee})
}

//join league will take a post request of a user's credentials and their desired league, check whether the league is already
//at capacity and whether the user is on the invitation list to the league. If so, We register them with the league.  We'll
//then reroute the user on the front-end to LeagueHome
func joinLeague(c *gin.Context) {
	session := sessions.Default(c)
	db := store.GetDB()
	type TeamSubmission struct {
		League int64  `json:"league"`
		Team   string `json:"team"`
	}
	var t TeamSubmission
	user := session.Get("user").(int64)
	if err := c.BindJSON(&t); err != nil {
		fmt.Println(err)
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer tx.Rollback()

	//Check leagues for maxOwner
	var maxOwners int64
	row := tx.QueryRow("SELECT maxOwner FROM league WHERE ID=?", t.League)
	if err := row.Scan(&maxOwners); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	var ownerCount int64
	row = tx.QueryRow("SELECT COUNT(*) FROM teams_" + strconv.FormatInt(t.League, 10))
	if err := row.Scan(&ownerCount); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//Check if we've already got a full league (This should only happen if a gm invites all slots then shrinks the league)
	if ownerCount >= maxOwners {
		c.JSON(http.StatusBadRequest, "Max teams in league reached.  Contact commissioner to increase team cap")
		return
	}

	//With that done, we can add the team to the league
	_, err = tx.Exec("INSERT INTO teams_"+
		strconv.FormatInt(t.League, 10)+
		" (name, manager) VALUES (?,?)", t.Team, user)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//And insert the league into leagues_userid
	_, err = tx.Exec("INSERT INTO leagues_"+
		strconv.FormatInt(user, 10)+
		" (league) VALUES (?)", t.League)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//We're not done yet though, remove the invite from both invites tables
	_, err = tx.Exec("DELETE FROM league_"+
		strconv.FormatInt(t.League, 10)+
		"_invites WHERE user=?", user)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec("DELETE FROM invites_"+
		strconv.FormatInt(user, 10)+
		" WHERE league=?", t.League)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
	}

	//With all that done, we can return a little thumbs up, and the component will update the league ID.
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
		MaxOwner int64  `json:"maxOwner"`
		Kind     string `json:"kind"`
	}
	var s LeagueSettings
	session := sessions.Default(c)
	if err := c.BindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer tx.Rollback()

	//A little verification that we're getting the request from the commissioner
	var commish int64
	user := session.Get("user").(int64)
	row := tx.QueryRow("SELECT commissioner FROM league WHERE ID=?", s.ID)
	if err := row.Scan(&commish); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	if user != commish {
		c.JSON(http.StatusBadRequest, "Unauthorized Edit.")
		return
	}
	//Verify new maxOwner is >= current team total.
	var teamCount int64
	row = tx.QueryRow("SELECT COUNT(*) FROM teams_" + strconv.FormatInt(s.ID, 10))
	if err := row.Scan(&teamCount); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	if s.MaxOwner < teamCount {
		c.JSON(http.StatusBadRequest, "Max owners less than current teams in league")
		return
	}

	//With that done, we can change the league values.
	_, err = tx.Exec("UPDATE league SET name=?, maxOwner=?, kind=? WHERE ID=?", s.Name, s.MaxOwner, s.Kind, s.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
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
	if err := c.BindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//With only a single command, I think we're fine to simply run as is instead of throwing it into a transaction
	_, err := db.Exec("UPDATE league SET state='PREDRAFT' WHERE ID=?", b.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"state": "PREDRAFT"})
}

type DraftSettings struct {
	ID         int
	Kind       string
	DraftOrder string
	Time       time.Time
	DraftClock int
	Rounds     int
}

type PositionalSettings struct {
	ID        int
	Kind      string
	QB        int
	RB        int
	WR        int
	TE        int
	Flex      int
	Bench     int
	Superflex int
	Def       int
	K         int
}

func (s *PositionalSettings) CountPositions() int {
	return s.QB + s.RB + s.WR + s.TE + s.Flex + s.Bench + s.Superflex + s.Def + s.K
}

func (s *PositionalSettings) ScanRow(r scanners.Row) error {
	return r.Scan(&s.ID,
		&s.Kind,
		&s.QB,
		&s.RB,
		&s.WR,
		&s.TE,
		&s.Flex,
		&s.Bench,
		&s.Superflex,
		&s.Def,
		&s.K)
}

type ScoringSettingsOff struct {
	ID                 int
	PassAttempt        float64
	PassCompletion     float64
	PassYard           float64
	PassTouchdown      float64
	PassInterception   float64
	PassSack           float64
	RushAttempt        float64
	RushYard           float64
	RushTouchdown      float64
	ReceivingTarget    float64
	Reception          float64
	ReceivingYard      float64
	ReceivingTouchdown float64
	Fumble             float64
	FumbleLost         float64
	MiscTouchdown      float64
	TwoPointConversion float64
	TwoPointPass       float64
}

type ScoringSettingDef struct {
	ID           int
	Touchdown    float64
	Sack         float64
	Interception float64
	Safety       float64
	Shutout      float64
	Points6      float64
	Points13     float64
	Points20     float64
	Points27     float64
	Points34     float64
	Points35     float64
	YardBonus    float64
	Yards        float64
}

type ScoringSettingsSpe struct {
	ID         int
	Fg29       float64
	Fg39       float64
	Fg49       float64
	Fg50       float64
	ExtraPoint float64
}

func (s *ScoringSettingsSpe) ScanRow(r scanners.Row) error {
	return r.Scan(
		&s.ID,
		&s.Fg29,
		&s.Fg39,
		&s.Fg49,
		&s.Fg50,
		&s.ExtraPoint)
}

func (s *ScoringSettingDef) ScanRow(r scanners.Row) error {
	return r.Scan(
		&s.ID,
		&s.Touchdown,
		&s.Sack,
		&s.Interception,
		&s.Safety,
		&s.Shutout,
		&s.Points6,
		&s.Points13,
		&s.Points20,
		&s.Points27,
		&s.Points34,
		&s.Points35,
		&s.YardBonus,
		&s.Yards)
}

func (s *ScoringSettingsOff) ScanRow(r scanners.Row) error {
	return r.Scan(
		&s.ID,
		&s.PassAttempt,
		&s.PassCompletion,
		&s.PassYard,
		&s.PassTouchdown,
		&s.PassInterception,
		&s.PassSack,
		&s.RushAttempt,
		&s.RushYard,
		&s.RushTouchdown,
		&s.ReceivingTarget,
		&s.Reception,
		&s.ReceivingYard,
		&s.ReceivingTouchdown,
		&s.Fumble,
		&s.FumbleLost,
		&s.MiscTouchdown,
		&s.TwoPointConversion,
		&s.TwoPointPass)
}

type ScoringSettingsTotal struct {
	O ScoringSettingsOff `json:"offense"`
	D ScoringSettingDef  `json:"defense"`
	S ScoringSettingsSpe `json:"special"`
}

type FullDraftSettings struct {
	D DraftSettings        `json:"draft"`
	P PositionalSettings   `json:"positional"`
	S ScoringSettingsTotal `json:"scoring"`
}

//While a little overwhelming, draft settings contains all the big customizable areas for a league.
//Initially I was thinking of splitting these requests accross several smaller components, but upon
//further reflection, I don't think it really helps much to be able to change these settings after
//the draft has commenced.
func getDraftSettings(c *gin.Context) {
	db := store.GetDB()
	var f FullDraftSettings
	leagueId, err := strconv.ParseInt(c.Param("ID"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//get those sweet draft settings.
	row := db.QueryRow("SELECT * FROM draft_settings WHERE ID=?", leagueId)
	if err = row.Scan(&f.D.ID, &f.D.Kind, &f.D.DraftOrder, &f.D.Time, &f.D.DraftClock, &f.D.Rounds); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	row = db.QueryRow("SELECT * FROM positional_settings WHERE ID=?", leagueId)
	if err = f.P.ScanRow(row); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	row = db.QueryRow("SELECT * FROM scoring_settings_offense WHERE ID=?", leagueId)
	if err = f.S.O.ScanRow(row); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	row = db.QueryRow("SELECT * FROM scoring_settings_defense WHERE ID=?", leagueId)
	if err = f.S.D.ScanRow(row); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	row = db.QueryRow("SELECT * FROM scoring_settings_special WHERE ID=?", leagueId)
	if err = f.S.S.ScanRow(row); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	c.JSON(http.StatusOK, f)
}

//Setdraftsettings will update draft & positional settings
func setDraftSettings(c *gin.Context) {
	db := store.GetDB()
	var f FullDraftSettings
	if err := c.BindJSON(&f); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer tx.Rollback()

	//Set those positions
	_, err = tx.Exec(`UPDATE positional_settings SET 
	kind=?, qb=?, rb=?, wr=?, te=?, flex=?, bench=?, superflex=?, def=?, k=? 
	WHERE ID=?`,
		f.P.Kind, f.P.QB, f.P.RB, f.P.WR, f.P.TE, f.P.Flex, f.P.Bench, f.P.Superflex, f.P.Def, f.P.K,
		f.P.ID)

	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//If implemented, we would check positional kind here to see which stats would be zeroed out
	//I.E. if individual defensive player we would zero yard_bonus, yards and all the point
	//allowed fields, conversely if traditional we would make sure individual tackles are zeroed out

	_, err = tx.Exec(`UPDATE scoring_settings_offense SET 
		pass_att=?, pass_comp=?, pass_yard=?, pass_td=?, pass_int=?, pass_sack=?,
		rush_att=?, rush_yard=?, rush_td=?, rec_tar=?, rec=?, rec_yard=?, rec_td=?,
		fum=?, fum_lost=?, misc_td=?, two_point=?, two_point_pass=? 
		WHERE ID=?`,
		f.S.O.PassAttempt, f.S.O.PassCompletion, f.S.O.PassYard, f.S.O.PassTouchdown, f.S.O.PassInterception, f.S.O.PassSack,
		f.S.O.RushAttempt, f.S.O.RushYard, f.S.O.RushTouchdown, f.S.O.ReceivingTarget, f.S.O.Reception, f.S.O.ReceivingYard, f.S.O.ReceivingTouchdown,
		f.S.O.Fumble, f.S.O.FumbleLost, f.S.O.MiscTouchdown, f.S.O.TwoPointConversion, f.S.O.TwoPointPass,
		f.S.O.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec(`UPDATE scoring_settings_defense SET
		touchdown=?, sack=?, interception=?, safety=?, shutout=?,
		points_6=?, points_13=?, points_20=?, points_27=?, points_34=?, points_35=?,
		yardBonus=?, yards=?
		Where ID=?`,
		f.S.D.Touchdown, f.S.D.Sack, f.S.D.Interception, f.S.D.Safety, f.S.D.Shutout,
		f.S.D.Points6, f.S.D.Points13, f.S.D.Points20, f.S.D.Points27, f.S.D.Points34, f.S.D.Points35,
		f.S.D.YardBonus, f.S.D.Yards,
		f.S.D.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	_, err = tx.Exec(`UPDATE scoring_settings_special SET
	fg_29=?, fg_39=?, fg_49=?, fg_50=?, extra_point=?
	WHERE ID=?`,
		f.S.S.Fg29, f.S.S.Fg39, f.S.S.Fg49, f.S.S.Fg50, f.S.S.ExtraPoint,
		f.S.S.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	// If they somehow get past the front end with more rounds than positions, we'll set rounds
	// to the total number of open positions.
	var rounds int
	if f.D.Rounds > f.P.CountPositions() {
		rounds = f.P.CountPositions()
	} else {
		rounds = f.D.Rounds
	}
	_, err = tx.Exec(`UPDATE draft_settings SET 
		kind=?, draftOrder=?, time=?, draftClock=?, rounds=? 
		WHERE ID=?`,
		f.D.Kind, f.D.DraftOrder, f.D.Time, f.D.DraftClock, rounds,
		f.D.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

//Individual lookup for scoring settings.  Not sure if necessary
func getScoringSettings(c *gin.Context) {
	db := store.GetDB()
	var t ScoringSettingsTotal

	leagueId, err := strconv.ParseInt(c.Param("ID"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	row := db.QueryRow("SELECT * FROM scoring_settings_offense WHERE ID=?", leagueId)
	if err = t.O.ScanRow(row); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	row = db.QueryRow("SELECT * FROM scoring_settings_defense WHERE ID=?", leagueId)
	if err = t.D.ScanRow(row); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	row = db.QueryRow("SELECT * FROM scoring_settings_special WHERE ID=?", leagueId)
	if err = t.S.ScanRow(row); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	c.JSON(http.StatusOK, t)
}

type order struct {
	Team int64
	Slot int64
}

//While we have a time for the draft to start, I think it's cromulent to actually have the commissioner
//manually start the draft.  I see the time provided in settings as more of a suggestion, as this allows
//the commissioner to delay the draft if there's difficulties for other users to access the draft area
//at the agreed time.
func startDraft(c *gin.Context) {
	db := store.GetDB()
	type LockLeagueBody struct {
		ID int64 `json:"league"`
	}
	var b LockLeagueBody
	if err := c.BindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	tx, err := db.Begin()
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer tx.Rollback()

	//We need to check if a draft order has been set.  If any teams have a slot set to zero, then
	//we want to create a random order.
	var orderCheck int64
	var d []order
	row := tx.QueryRow("SELECT COUNT(*) FROM teams_" + strconv.FormatInt(b.ID, 10) + " WHERE slot = 0")
	if err = row.Scan(&orderCheck); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	//Check if order has been set, if not, create random order, otherwise fetch the draft
	//order
	if orderCheck > 0 {
		var teamCount int64
		rand.Seed(time.Now().UnixNano())
		row = tx.QueryRow("SELECT COUNT(*) FROM teams_" + strconv.FormatInt(b.ID, 10))
		if err = row.Scan(&teamCount); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}

		//We'll use shuffle to create a pseudo-random draft order.
		var slots []int
		for i := 0; i < int(teamCount); i++ {
			slots = append(slots, i+1)
		}
		rand.Shuffle(len(slots), func(i, j int) {
			slots[i], slots[j] = slots[j], slots[i]
		})

		rows, err := tx.Query("SELECT id FROM teams_" + strconv.FormatInt(b.ID, 10))
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		defer rows.Close()
		i := 0
		for rows.Next() {
			var o order
			if err = rows.Scan(&o.Team); err != nil {
				c.JSON(http.StatusBadRequest, err.Error())
				return
			}
			o.Slot = int64(slots[i])
			i++
			d = append(d, o)
		}

		//add draft order to db for other clients to read.
		for _, slot := range d {
			_, err = tx.Exec("UPDATE teams_"+strconv.FormatInt(b.ID, 10)+" SET slot=? WHERE ID=?", slot.Slot, slot.Team)
			if err != nil {
				c.JSON(http.StatusBadRequest, err.Error())
				return
			}
		}
	} else {
		//Fetch from draft order?  I can't think of the exact edge case where we would need to return this,
		//but for consistency we'll return the draft order whether we need to generate it or not.
		rows, err := tx.Query("SELECT id, slot FROM teams_" + strconv.FormatInt(b.ID, 10))
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		defer rows.Close()
		for rows.Next() {
			var o order
			if err = rows.Scan(&o.Team, &o.Slot); err != nil {
				c.JSON(http.StatusBadRequest, err.Error())
				return
			}
			d = append(d, o)
		}
	}

	_, err = tx.Exec("UPDATE league SET state='DRAFT' WHERE ID=?", b.ID)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}

	c.JSON(http.StatusOK, d)
}

//For now, we'll just retrieve all the players in the generic pool.  Later, we'll need to return defenses and kickers
//as well
func DraftPool(c *gin.Context) {
	db := store.GetDB()
	var p scanners.PlayerList
	rows, err := db.Query("SELECT * FROM player")
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		if err = p.ScanRow(rows); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
	}
	c.JSON(http.StatusOK, p)
}

type draftSlot struct {
	Slot   int64
	Player int64
	Team   int64
}

func draftHistory(c *gin.Context) {
	db := store.GetDB()

	_, err := strconv.ParseInt(c.Param("ID"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	//var history []draftSlot is nil when unassigned.  We want an empty array if there's
	//no history to return
	var history = make([]draftSlot, 0)
	rows, err := db.Query("SELECT * FROM draft_" + c.Param("ID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, err.Error())
		return
	}
	defer rows.Close()
	for rows.Next() {
		var d draftSlot
		if err = rows.Scan(&d.Slot, &d.Player, &d.Team); err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
			return
		}
		history = append(history, d)
	}
	c.JSON(http.StatusOK, history)
}
