package scanners

// //https://stackoverflow.com/questions/53175792/how-to-make-scanning-db-rows-in-go-dry I'm not sure how much I want to implement of this,
// //and it's likely at least a little obsolete as soon as 1.18 drops, but some informative information on implementing interfaces
type Row interface {
	Scan(...interface{}) error
}

type Player struct {
	ID                  int64
	Name                string
	PfbrName            string
	Team                string
	Position            string
	Age                 uint8
	Games               uint
	Starts              uint
	PassCompletions     uint
	PassAttempts        uint
	PassYards           int
	PassTouchdowns      uint
	PassInterceptions   uint
	RushAttempts        uint
	RushYards           int
	RushTouchdowns      uint
	Targets             uint
	Receptions          uint
	ReceivingYards      int
	ReceivingTouchdowns uint
	Fumbles             uint
	FumblesLost         uint
	AllTouchdowns       uint
	TwoPointConversion  uint
	TwoPointPass        uint
	FantasyPoints       int
	PointPerReception   float64
	ValueBased          int
}

func (p *Player) ScanRow(r Row) error {
	return r.Scan(&p.ID,
		&p.Name,
		&p.PfbrName,
		&p.Team,
		&p.Position,
		&p.Age,
		&p.Games,
		&p.Starts,
		&p.PassCompletions,
		&p.PassAttempts,
		&p.PassYards,
		&p.PassTouchdowns,
		&p.PassInterceptions,
		&p.RushAttempts,
		&p.RushYards,
		&p.RushTouchdowns,
		&p.Targets,
		&p.Receptions,
		&p.ReceivingYards,
		&p.ReceivingTouchdowns,
		&p.Fumbles,
		&p.FumblesLost,
		&p.AllTouchdowns,
		&p.TwoPointConversion,
		&p.TwoPointPass,
		&p.FantasyPoints,
		&p.PointPerReception,
		&p.ValueBased)
}

type PlayerList struct {
	Players []Player
}

// Implements RowScanner
func (list *PlayerList) ScanRow(r Row) error {
	var u Player
	if err := u.ScanRow(r); err != nil {
		return err
	}
	list.Players = append(list.Players, u)
	return nil
}
