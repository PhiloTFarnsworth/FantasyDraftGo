DROP TABLE IF EXISTS league;
/*
Keeping with our original structure, We need to create a league to assign teams to.  To keep things snappy, I think this
is the big table.  When we look up a league (through ID), we return the League's name, a user's primary key and a nice 
little bool to inform us if the draft is complete.  We'll also track the state of the league through the state enum
*/
CREATE TABLE league (
    id INT AUTO_INCREMENT NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    commissioner INT NOT NULL,
    state ENUM('INIT', 'DRAFT', 'INPROGRESS', 'COMPLETE') DEFAULT 'INIT',
    maxOwner TINYINT NOT NULL,
    primary key (`id`)
)
