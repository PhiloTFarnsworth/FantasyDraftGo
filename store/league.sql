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

DROP TABLE IF EXISTS league;
CREATE TABLE league (
    id INT AUTO_INCREMENT NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    commissioner INT NOT NULL,
    state ENUM('INIT', 'DRAFT', 'INPROGRESS', 'COMPLETE') DEFAULT 'INIT',
    maxOwner TINYINT NOT NULL,
    kind ENUM('TRAD', 'TP', 'ALLPLAY', 'PIRATE', 'GUILLOTINE') DEFAULT 'TRAD',
    primary key (`id`)
);

/*
We'll keep draft settings on it's own table.  It's only accessible for a while and it's not terribly relevant after the draft,
so we'll more effectively resist the temptation to call for this info.
*/

DROP TABLE IF EXISTS draft_settings;
CREATE TABLE draft_settings (
    id INT NOT NULL UNIQUE,
    kind ENUM('TRAD', 'CUSTOM') DEFAULT 'TRAD',
    draftOrder ENUM('SNAKE', 'STRAIGHT', 'CURSED', 'CUSTOM') DEFAULT 'SNAKE',
    auction BOOLEAN NOT NULL DEFAULT 0,
    time DATETIME NOT NULL DEFAULT '0000-00-00 00:00:00',
    draftClock BOOLEAN NOT NULL DEFAULT 0,
    rounds TINYINT NOT NULL DEFAULT 15,
    trades BOOLEAN NOT NULL DEFAULT 0 
);
/*
The same logic applies to positional settings.  We'll allow commissioners to define
how many starters a team can use at each position.  Defaults will match the traditional
roster build.
*/
DROP TABLE IF EXISTS positional_settings;
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
    p TINYINT NOT NULL DEFAULT 0
);

/*
We're going to allow a decent sized range for point per stat.  .01 - 99 per 1 in each stat seems like fair
compromise.  We're also trying to be comprehensive in what stats the user can apply scoring to.  While
the final implementation might be limited by what we can get, we should aspire to cover as many stats as
possible
*/

DROP TABLE IF EXISTS scoring_settings;
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
    def_shutout DECIMAL (4,2) NOT NULL DEFAULT 10,
    def_yards DECIMAL (4,2) NOT NULL DEFAULT -0.01, 
    spec_return_yards DECIMAL (4,2) NOT NULL DEFAULT 0,
    spec_return_td DECIMAL (4,2) NOT NULL DEFAULT 6,
    spec_fg DECIMAL (4,2) NOT NULL DEFAULT 3, 
    spec_punt DECIMAL (4,2) NOT NULL DEFAULT 0
);
/*
Invites_0 will hold our unregisted league invites.  We'll use 0 as we refer to an
anonymous user id as zero several times in the front end.  We could got with something
like anon invites, but I think this works.  We'll take the email and the league they
wish to join.  
*/

DROP TABLE IF EXISTS invites_0;
CREATE TABLE invites_0 (
    league INT NOT NULL,
    email VARCHAR(256) NOT NULL
)