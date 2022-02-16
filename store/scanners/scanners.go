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

func (s *PositionalSettings) ScanRow(r Row) error {
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

func (s *ScoringSettingsSpe) ScanRow(r Row) error {
	return r.Scan(
		&s.ID,
		&s.Fg29,
		&s.Fg39,
		&s.Fg49,
		&s.Fg50,
		&s.ExtraPoint)
}

func (s *ScoringSettingDef) ScanRow(r Row) error {
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

func (s *ScoringSettingsOff) ScanRow(r Row) error {
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
