/*
These are the tables to create when starting a fresh instance for Fantasy Football leagues.  We've got the league identifying
table, which gives the broad outline of the identity of the league, as well as sub tables that give a fuller understanding
of the specifics.  We're going to attempt to create a highly customizable format that allows commissioners to dream up new
types of league games.  While we're going to have to show discipline on the front end to enable this creativity without 
overwhelming casual users, but I think being able to create leagues where you score more for picking players with bad
stats, or a fantasy punters league brings a lot to the table.

Keeping with our original structure, We need to create a league to assign teams to.  To keep things snappy, I think this
is the big table.  When we look up a league (through ID), we return the League's name, a user's primary key and a nice 
little bool to inform us if the draft is complete.  We'll also track the state of the league through the state enum,
and give ourselves a kind which informs the type of competition this league is engaging in.
*/

/*
    Incorporating foreign keys means we want to release all our tables in order of dependencies when rebuilding
    our testing database (or clearing our development one)
*/
DROP TABLE IF EXISTS invites_0;
DROP TABLE IF EXISTS scoring_settings_special;
DROP TABLE IF EXISTS scoring_settings_defense;
DROP TABLE IF EXISTS scoring_settings_offense;
DROP TABLE IF EXISTS draft_settings;
DROP TABLE IF EXISTS positional_settings;
DROP TABLE IF EXISTS league;

CREATE TABLE league (
    ID INT AUTO_INCREMENT NOT NULL UNIQUE PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    commissioner INT NOT NULL,
    state ENUM('INIT', 'PREDRAFT', 'DRAFT', 'INPROGRESS', 'COMPLETE') DEFAULT 'INIT',
    maxOwner TINYINT NOT NULL,
    kind ENUM('TRAD', 'TP', 'ALLPLAY', 'PIRATE', 'GUILLOTINE') DEFAULT 'TRAD'
);

/*
We'll keep draft settings on it's own table.  It's only accessible for a while and it's not terribly relevant after the draft,
so we'll more effectively resist the temptation to call for this info.
*/
CREATE TABLE draft_settings (
    ID INT NOT NULL UNIQUE,
    kind ENUM('TRAD', 'AUCTION') DEFAULT 'TRAD',
    draftOrder ENUM('SNAKE', 'STRAIGHT', 'CURSED', 'CUSTOM') DEFAULT 'SNAKE',
    time DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
    draftClock TINYINT NOT NULL DEFAULT 0,
    rounds TINYINT NOT NULL DEFAULT 15,
    FOREIGN KEY (ID)
        REFERENCES league(ID)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

/*
The same logic applies to positional settings.  We'll allow commissioners to define
how many starters a team can use at each position.  Much like draft settings, we'll want to lock (or soft lock)
these values after a draft has officially started, though we may add an option to allow commissioners to add
a bench spot during a season.  
*/
CREATE TABLE positional_settings (
    ID INT NOT NULL UNIQUE,
    kind ENUM('TRAD', 'IDP', 'CUSTOM') DEFAULT 'TRAD',
    qb TINYINT NOT NULL DEFAULT 1,
    rb TINYINT NOT NULL DEFAULT 2,
    wr TINYINT NOT NULL DEFAULT 2,
    te TINYINT NOT NULL DEFAULT 1,
    flex TINYINT NOT NULL DEFAULT 1,
    bench TINYINT NOT NULL DEFAULT 6,
    superflex TINYINT NOT NULL DEFAULT 0,
    def TINYINT NOT NULL DEFAULT 1,
    k TINYINT NOT NULL DEFAULT 1,
    FOREIGN KEY (ID)
        REFERENCES league(ID)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

/*
    TODO:
    p TINYINT NOT NULL DEFAULT 0 --All Punters League 1 day
    dl TINYINT NOT NULL DEFAULT 0, -- Individual defensive player 
    lb TINYINT NOT NULL DEFAULT 0,
    db TINYINT NOT NULL DEFAULT 0,
*/

/*
We're going to allow a decent sized range for point per stat.  .01 - 99 per 1 in each stat seems like fair
compromise.  We're also trying to be comprehensive in what stats the user can apply scoring to.  While
the final implementation might be limited by what we can get, we should aspire to cover as many stats as
possible
*/
CREATE TABLE scoring_settings_offense (
    ID INT NOT NULL UNIQUE,
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
    FOREIGN KEY (ID)
        REFERENCES league(ID)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

/* after some reflection, we're only really going to have these settings called all at
once when users are checking the scoring settings of a league.  When we reference them
to apply scoring, we'll likely be applying a only a subset for each player.  So instead
of one big scoring table, we'll split it into three, regarding offense, defense and special
teams.  We'll also replace the scaling yard thresholds (like the points allowed) and instead
have the defense start with a bonus, that diminishes for every yard gained.  So default
you get 3 points for 0 yards, and start going negative when the defense gives up 300 yards.
*/
CREATE TABLE scoring_settings_defense (
    ID INT NOT NULL UNIQUE,
    touchdown DECIMAL (4,2) NOT NULL DEFAULT 6,
    sack DECIMAL (4,2) NOT NULL DEFAULT 1,
    interception DECIMAL (4,2) NOT NULL DEFAULT 3,
    safety DECIMAL (4,2) NOT NULL DEFAULT 2,
    shutout DECIMAL (4,2) NOT NULL DEFAULT 10,
    points_6 DECIMAL (4,2) NOT NULL DEFAULT 7,
    points_13 DECIMAL (4,2) NOT NULL DEFAULT 4,
    points_20 DECIMAL (4,2) NOT NULL DEFAULT 1,
    points_27 DECIMAL (4,2) NOT NULL DEFAULT 0,
    points_34 DECIMAL (4,2) NOT NULL DEFAULT -1,
    points_35 DECIMAL (4,2) NOT NULL DEFAULT -4,
    yardBonus DECIMAL (4,2) NOT NULL DEFAULT 3,
    yards DECIMAL (4,2) NOT NULL DEFAULT -0.01,
    FOREIGN KEY (ID)
        REFERENCES league(ID)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

/*
For the time being we'll just inlude kicker stats.  Returns can be covered by defensive touchdowns
until IDP is implemented.
*/
CREATE TABLE scoring_settings_special (
    ID INT NOT NULL UNIQUE,
    fg_29 DECIMAL (4,2) NOT NULL DEFAULT 3,
    fg_39 DECIMAL (4,2) NOT NULL DEFAULT 3,
    fg_49 DECIMAL (4,2) NOT NULL DEFAULT 3,
    fg_50 DECIMAL (4,2) NOT NULL DEFAULT 3,
    extra_point DECIMAL (4,2) NOT NULL DEFAULT 1,
    FOREIGN KEY (ID)
        REFERENCES league(ID)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


/*
    TODO:
    spec_punt DECIMAL (4,2) NOT NULL DEFAULT 0 --Not important at the moment
    def_tackle DECIMAL (4,2) NOT NULL DEFAULT 0, --Individual Defensive players
    spec_return_yards DECIMAL (4,2) NOT NULL DEFAULT 0, --I don't think I'm tracking this stat in demo
    spec_return_td DECIMAL (4,2) NOT NULL DEFAULT 6, --covered by misc td atm
*/



/*
Invites_0 will hold our unregisted league invites.  We'll use 0 as we refer to an
anonymous user ID as zero several times in the front end.  We could got with something
like anon invites, but I think this works.  We'll take the email and the league they
wish to join.  
*/

CREATE TABLE invites_0 (
    league INT NOT NULL,
    email VARCHAR(256) NOT NULL,
    FOREIGN KEY (league)
        REFERENCES league(ID)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);