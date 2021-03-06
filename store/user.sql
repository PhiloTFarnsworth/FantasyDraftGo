/*
    We fire this script up for our user database.  This could become more complicated, 
    but for the moment it'll suit our needs.
*/

DROP TABLE IF EXISTS user;
CREATE TABLE user (
    ID INT AUTO_INCREMENT NOT NULL UNIQUE PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    passhash VARCHAR(128) NOT NULL,
    email VARCHAR(256) NOT NULL UNIQUE
)

