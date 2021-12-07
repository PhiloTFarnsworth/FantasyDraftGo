
--Teams will be found in a teams_[league id] table, we want to keep a primary key, a name, a manager foriegn key.  
CREATE TABLE teams_#league_id (
    id INT AUTO_INCREMENT NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    manager INT NOT NULL,
    primary key (`id`)
)

-- So for every league we need to create a new draft table, which will keep track of our drafted players.  We'll name the table
-- draft_[league id], use the id to keep track of draft position, the player id to keep track of player, and the int of the team
-- that selected the player.
CREATE TABLE draft_#league_id (
    id INT AUTO_INCREMENT NOT NULL UNIQUE,
    player INT NOT NULL UNIQUE,
    team INT NOT NULL,
    primary key (`id`)
)

--We'll correllate team and spot on it's own table.  While we could include this on the teams_ table, this is going to be
--way easier for generating new draft orders (ether set by commish or randomized).
CREATE TABLE draft_order_#league (
    team INT NOT NULL UNIQUE,
    spot INT NOT NULL UNIQUE
)

--We'll keep draft settings on it's own table.  It's only accessible for a while and it's not terribly relevant after the draft,
--so we'll more effectively resist the temptation to call for this info.
CREATE TABLE draft_settings (
    id INT NOT NULL UNIQUE,
    kind ENUM('TRAD', 'AUCTION', 'CUSTPOM') DEFAULT 'TRAD',
    order ENUM('STRAIGHT', 'SNAKE', 'CURSED')
    auction BOOL DEFAULT 0,
    time TIMESTAMP,
    draftClock bool DEFAULT 0,
    rounds TINYINT NOT NULL,
    trades BOOL DEFAULT 0 
)

--The same logic applies to positional settings.  We'll allow commissioners to define
--how many starters a team can use at each position.  Defaults will match the traditional
--roster build.
CREATE TABLE positional_settings (
    id TINYINT NOT NULL UNIQUE,
    kind ENUM('TRAD', 'IDP', 'CUSTOM') DEFAULT 'TRAD',
    qb TINYINT NOT NULL DEFAULT 1,
    rb TINYINT NOT NULL DEFAULT 2,
    wr TINYINT NOT NULL DEFAULT 2,
    te TINYINT NOT NULL DEFAULT 1,
    flex TINYINT NOT NULL DEFAULT 1,
    bench TINYINT NOT NULL DEFAULT 6,
    superflex TINYINT NOT NULL DEFAULT 0,
    def TINYINT NOT NULL DEFAULT 1,
    dl TINYINT NOT NULL DEFAULT 0,
    lb TINYINT NOT NULL DEFAULT 0,
    db TINYINT NOT NULL DEFAULT 0,
    k TINYINT NOT NULL DEFAULT 1,
    p TINYINT NOT NULL DEFAULT 0,
    ol TINYINT NOT NULL DEFAULT 0
)

--We're going to allow a decent sized range for point per stat.  .01 - 99 per 1 in each stat seems like fair
--compromise.  We're also trying to be comprehensive in what stats the user can apply scoring to.  While
--the final implementation might be limited by what we can get, we should aspire to cover as many stats as
-- possible
CREATE TABLE scoring_settings (
    id INT NOT NULL UNIQUE,
    kind ENUM('TRAD', 'PPR', 'CUSTOM') DEFAULT 'TRAD',
    pass_att DECIMAL(4,2) NOT NULL DEFAULT 0,
    pass_comp DECIMAL(4,2) NOT NULL DEFAULT 0,
    pass_yard DECIMAL(4,2) NOT NULL DEFAULT 0.04,
    pass_td DECIMAL (4,2) NOT NULL DEFAULT 6,
    pass_int DECIMAL (4,2) NOT NULL DEFAULT -3,
    pass_sack DECIMAL (4,2) NOT NULL DEFAULT 0,
    rush_att DECIMAL (4,2) NOT NULL DEFAULT 0,
    rush_yard DECIMAL(4,2) NOT NULL DEFAULT 0.1,
    rush_td DECIMAL (4,2) NOT NULL DEFAULT 6,
    rec_tar DECIMAL (4,2) NOT NULL DEFAULT 0,
    rec DECIMAL (4,2) NOT NULL DEFAULT 0,
    rec_yard DECIMAL(4,2) NOT NULL DEFAULT 0.1,
    rec_td DECIMAL (4,2) NOT NULL DEFAULT 6,
    fum DECIMAL (4,2) NOT NULL DEFAULT -1,
    fum_lost DECIMAL (4,2) NOT NULL DEFAULT -2,
    misc_td DECIMAL (4,2) NOT NULL DEFAULT 6,
    two_point DECIMAL (4,2) NOT NULL DEFAULT 2,
    two_point_pass DECIMAL (4,2) NOT NULL DEFAULT 2,
    def_td DECIMAL (4,2) NOT NULL DEFAULT 6,
    def_tackle DECIMAL (4,2) NOT NULL DEFAULT 0,
    def_sack DECIMAL (4,2) NOT NULL DEFAULT 1,
    def_int DECIMAL (4,2) NOT NULL DEFAULT 3,
    def_safety DECIMAL (4,2) NOT NULL DEFAULT 2,
    def_shutout DECIMAL (4,2) NOT NULL DEFAULT 10,--ranges?
    def_yards DECIMAL (4,2) NOT NULL DEFAULT -0.01, --Start with 5 points, deduct point per 100 yards?
    spec_return_yards DECIMAL (4,2) NOT NULL DEFAULT 0,
    spec_return_td DECIMAL (4,2) NOT NULL DEFAULT 6,
    spec_fg DECIMAL (4,2) NOT NULL DEFAULT 3, --ranges?
    spec_punt DECIMAL (4,2) NOT NULL DEFAULT 0
)

--Finally, we have the roster table created for each league.  We'll filter by team ID to place all players on their rosters
CREATE TABLE roster_#league_id (
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
CREATE TABLE transactions_#league_id (
    id INT AUTO_INCREMENT NOT NULL UNIQUE,
    player INT NOT NULL,
    team INT NOT NULL,
    source INT NOT NULL,
    associated INT DEFAULT 0,
    initiated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    primary key(`id`)

)

--For each user, need to create a seperate table housing their leagues.
CREATE TABLE leagues_#user id (
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

--Invites_0 will hold our unregisted league invites.  We'll use 0 as we refer to an
--anonymous user id as zero several times in the front end.  We could got with something
--like anon invites, but I think this works.  We'll take the email and the league they
--wish to join.  
CREATE TABLE invites_0 (
    league INT NOT NULL,
    email VARCHAR(256) NOT NULL
)