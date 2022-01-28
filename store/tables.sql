/*
    These are tables we create in our application code.  
*/


--Teams will be found in a teams_[league ID] table, we want to keep a primary key, a name, a manager foriegn key.  
CREATE TABLE teams_#leagueID (
    ID INT AUTO_INCREMENT NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    manager INT NOT NULL,
    primary key (`ID`)
)

-- So for every league we need to create a new draft table, which will keep track of our drafted players.  We'll name the table
-- draft_[league ID], use the ID to keep track of draft position, the player ID to keep track of player, and the int of the team
-- that selected the player.
CREATE TABLE draft_#leagueID (
    ID INT AUTO_INCREMENT NOT NULL UNIQUE,
    player INT NOT NULL UNIQUE,
    team INT NOT NULL,
    primary key (`ID`)
)

--We'll correllate team and spot on it's own table.  While we could include this on the teams_ table, this is going to be
--way easier for generating new draft orders (ether set by commish or randomized).
CREATE TABLE draft_order_#leagueID (
    team INT NOT NULL UNIQUE,
    spot INT NOT NULL UNIQUE
)


--Finally, we have the roster table created for each league.  We'll filter by team ID to place all players on their rosters
CREATE TABLE roster_#leagueID (
    player INT NOT NULL UNIQUE,
    active BOOL DEFAULT 0,
    team INT NOT NULL
)

--Transactions will cover all roster moves outside of the draft.  I believe we've got a good framework to represent trades
--and roster additions subtractions.  We'll consider all transactions additive, a player always goes somewhere and comes from
--somewhere else.  In this case, we'll consider 0 to be the general player pool, so when a team drops a player, the transaction
-- will be player_id to team 0 from the team that dropped them.  We also have an associated INT, which will refer to other 
-- transactions in case of a trade.  Whichever part of the trade is processed first will have their ID saved for the associated
-- field of any related trade. 
CREATE TABLE transactions_#leagueID (
    ID INT AUTO_INCREMENT NOT NULL UNIQUE,
    player INT NOT NULL,
    team INT NOT NULL,
    source INT NOT NULL,
    associated INT DEFAULT 0,
    initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    primary key(`ID`)

)

--For each user, need to create a seperate table housing their leagues.
CREATE TABLE leagues_#userID (
    league INT NOT NULL UNIQUE
)

--League invitations for each user.  Create an invite when inviting
--Delete invitation when user joins a league.
CREATE TABLE invites_#userID (
    league INT NOT NULL UNIQUE
)
--Same logic, but we'll track it from the league side so commissioners can track who
--they have already invited.  We won't use a unique user INT because we'll put anonymous
--users as a 0, and simply track them from the below table.  Once they are converted to a 
--a registered user, we'll update their 0 to their ID. 
CREATE TABLE league_#leagueID_invites (
    user INT NOT NULL
)

