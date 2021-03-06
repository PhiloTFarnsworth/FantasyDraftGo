DROP TABLE IF EXISTS player;
CREATE TABLE player (
    ID INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    pfbr_name VARCHAR(128) NOT NULL,
    team VARCHAR(3) NOT NULL,
    position ENUM('QB', 'RB', 'WR', 'TE') NOT NULL,
    age TINYINT UNSIGNED NOT NULL,
    games SMALLINT UNSIGNED NOT NULL,
    starts SMALLINT UNSIGNED NOT NULL,
    pass_completions SMALLINT UNSIGNED NOT NULL,
    pass_attempts SMALLINT UNSIGNED NOT NULL,
    pass_yards MEDIUMINT NOT NULL,
    pass_touchdowns SMALLINT UNSIGNED NOT NULL,
    pass_interceptions SMALLINT UNSIGNED NOT NULL,
    rush_attempts SMALLINT UNSIGNED NOT NULL,
    rush_yards SMALLINT NOT NULL,
    rush_touchdowns SMALLINT UNSIGNED NOT NULL,
    targets SMALLINT UNSIGNED NOT NULL,
    receptions SMALLINT UNSIGNED NOT NULL,
    receiving_yards SMALLINT NOT NULL,
    receiving_touchdowns SMALLINT UNSIGNED NOT NULL,
    fumbles SMALLINT UNSIGNED NOT NULL,
    fumbles_lost SMALLINT UNSIGNED NOT NULL,
    all_touchdowns SMALLINT UNSIGNED NOT NULL,
    two_point_conversion SMALLINT UNSIGNED NOT NULL,
    two_point_pass SMALLINT UNSIGNED NOT NULL,
    fantasy_points SMALLINT NOT NULL,
    point_per_reception DECIMAL(4,1) NOT NULL,
    value_based SMALLINT NOT NULL
);