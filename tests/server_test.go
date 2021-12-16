package tests

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/PhiloTFarnsworth/FantasySportsAF/server"
	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
	"github.com/gin-gonic/gin"
	csrf "github.com/utrack/gin-csrf"
)

//We're going to keep a whole heap of tests here.  The first question, is how do we model the database
//we connect to.  Ideally, we'd group these tests to connect to a a test database and create a fresh
//instance of our database.  We'd then do a preliminary test of register, logout, login.  Then a
//single user create league and invite anonymous user.  Have the invited anonymous user then join the
//platform, join the invited league, then create a league of their own and invite the first user.
//Then we'll attempt to fill both leagues with players, lock both leagues and mess with some settings.

type client struct {
	csrf   string
	cookie string
}

var larryClient client
var barryClient client
var marryClient client

var r *gin.Engine

//Set up our test server and test database, add csrftoken path to create a client
func TestMain(m *testing.M) {
	store.ConnectDB("testfsgo")
	db := store.GetDB()
	//create/clear testfsgo database
	//./store/league.sql
	err := store.BatchSQLFromFile(os.Getenv("FSLSA"), db)
	if err != nil {
		fmt.Println("league batch: ", err)
		os.Exit(1)
	}
	//./store/user.sql
	err = store.BatchSQLFromFile(os.Getenv("FSUSA"), db)
	if err != nil {
		fmt.Println("league batch: ", err)
		os.Exit(1)
	}
	r = server.NewRouter()

	//Fake path to retrieve csrf token
	r.GET("csrftoken", func(c *gin.Context) { c.String(http.StatusOK, csrf.GetToken(c)) })

	os.Exit(m.Run())
}

func TestAnonIndex(t *testing.T) {
	w := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("wanted http.StatusOK code got %v", w.Code)
	}
	//scuffed, but I don't really want to add a dependency for the single html file we parse.
	if !strings.Contains(w.Body.String(), `<script type="text" id="userID">0</script>`) {
		t.Errorf(`wanted <script type="text" id="userID">0</script>`)
	}
}

func TestRegister(t *testing.T) {
	//Larry and better larry
	larry := `{"username":"larry","password":"test","email":"larry@mail.com"}`
	larryV2 := `{"id":1,"name":"larry","email":"larry@mail.com"}`
	//Larry's client
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}
	w, err := postJSON(a, "/register", larry, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}

	if w.Body.String() != larryV2 {
		t.Errorf("wanted %v got %v", larryV2, w.Body.String())
	}
	//We'll also check the persistance of the session from a register action.
	headers := w.Header()
	a.cookie = headers.Get("Set-Cookie")
	w = httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("wanted http.StatusOK code got %v", w.Code)
	}
	if !strings.Contains(w.Body.String(), `<script type="text" id="userID">1</script>`) {
		t.Errorf(`wanted <script type="text" id="userID">1</script> got %v`, w.Body.String())
	}
	larryClient = a
}

func TestRegisterBadSame(t *testing.T) {
	larry := `{"username":"larry","password":"test","email":"larry@mail.com"}`
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}
	_, err = postJSON(a, "/register", larry, http.StatusBadRequest)
	if err != nil {
		t.Fatal(err)
	}
}

func TestRegisterBadUsername(t *testing.T) {
	larry := `{"username":"larry","password":"test","email":"barry@mail.com"}`
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}
	_, err = postJSON(a, "/register", larry, http.StatusBadRequest)
	if err != nil {
		t.Fatal(err)
	}
}

func TestRegisterBadEmail(t *testing.T) {
	larry := `{"username":"barry","password":"test","email":"larry@mail.com"}`
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}
	_, err = postJSON(a, "/register", larry, http.StatusBadRequest)
	if err != nil {
		t.Fatal(err)
	}
}

func TestLogin(t *testing.T) {
	larry := `{"username":"larry","password":"test"}`
	larryV2 := `{"id":1,"name":"larry","email":"larry@mail.com"}`
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}

	w, err := postJSON(a, "/login", larry, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}

	if w.Body.String() != larryV2 {
		t.Errorf("wanted %v got %v", larryV2, w.Body.String())
	}

	//Much like register
	headers := w.Header()
	a.cookie = headers.Get("Set-Cookie")
	w = httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("wanted http.StatusOK code got %v", w.Code)
	}
	if !strings.Contains(w.Body.String(), `<script type="text" id="userID">1</script>`) {
		t.Errorf(`wanted <script type="text" id="userID">1</script> got %v`, w.Body.String())
	}
}
func TestLoginBadPass(t *testing.T) {
	larry := `{"username":"larry","password":"best"}`
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}

	_, err = postJSON(a, "/login", larry, http.StatusBadRequest)
	if err != nil {
		t.Fatal(err)
	}
}

func TestLoginBadUser(t *testing.T) {
	larry := `{"username":"Darry","password":"test"}`
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}

	_, err = postJSON(a, "/login", larry, http.StatusBadRequest)
	if err != nil {
		t.Fatal(err)
	}
}

func TestCreateLeague(t *testing.T) {
	a := larryClient
	leagueSettings := `{"maxOwner":4,"league":"All Arry League","team":"Lawrence of Arry-bia"}`
	w, err := postJSON(a, "/createleague", leagueSettings, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"leagueID":1}`
	if w.Body.String() != want {
		t.Errorf("want %v got %v", want, w.Body.String())
	}
}

func TestGetLeagues(t *testing.T) {
	a := larryClient
	w := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/leagues", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("wanted http.StatusOK code got %v", w.Code)
	}
	want := `{"invites":null,"leagues":[{"ID":1,"Name":"All Arry League"}]}`
	if w.Body.String() != want {
		t.Errorf("want %v", want)
		t.Errorf("got %v", w.Body.String())
	}
}

func TestInviteUnregistered(t *testing.T) {
	a := larryClient
	barry := `{"invitee":"barry@mail.com","league":1}`
	w, err := postJSON(a, "/invite", barry, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"id":0,"name":"Unregistered","email":"barry@mail.com"}`
	if w.Body.String() != want {
		t.Errorf("want %v", want)
		t.Errorf("got %v", w.Body.String())
	}
}

//NOTE: Bad attempts to register trigger auto-increment.  I guess this is a feature, so an explanation in case someone was wondering why barryV2 has an
//id of 5.
func TestRegisterInvited(t *testing.T) {
	//barry and better barry
	barry := `{"username":"barry","password":"test","email":"barry@mail.com"}`
	barryV2 := `{"id":5,"name":"barry","email":"barry@mail.com"}`
	//barry's client
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}
	w, err := postJSON(a, "/register", barry, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}

	if w.Body.String() != barryV2 {
		t.Errorf("wanted %v got %v", barryV2, w.Body.String())
	}
	headers := w.Header()
	a.cookie = headers.Get("Set-Cookie")
	barryClient = a
}

func TestGetLeaguesInvite(t *testing.T) {
	a := barryClient
	w := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/leagues", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("wanted http.StatusOK code got %v", w.Code)
	}
	want := `{"invites":[{"ID":1,"Name":"All Arry League"}],"leagues":null}`
	if want != w.Body.String() {
		t.Errorf("want %v", want)
		t.Errorf("got %v", w.Body.String())
	}
}

func TestJoinLeague(t *testing.T) {
	a := barryClient
	body := `{"league":1,"team":"Barry good, Barry barry barry good"}`
	w, err := postJSON(a, "/joinleague", body, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"ok":true}`
	if w.Body.String() != want {
		t.Errorf("want %v got %v", want, w.Body.String())
	}
	//We'll check leagues for more confirmation
	w = httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/leagues", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("wanted http.StatusOK code got %v", w.Code)
	}
	want = `{"invites":null,"leagues":[{"ID":1,"Name":"All Arry League"}]}`
	if want != w.Body.String() {
		t.Errorf("want %v", want)
		t.Errorf("got %v", w.Body.String())
	}
}

func TestInviteRegistered(t *testing.T) {
	//marry and better marry
	marry := `{"username":"marry","password":"test","email":"marry@mail.com"}`
	marryV2 := `{"id":6,"name":"marry","email":"marry@mail.com"}`
	//marry's client
	a, err := getCSRF(r)
	if err != nil {
		t.Fatal(err)
	}
	w, err := postJSON(a, "/register", marry, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}

	if w.Body.String() != marryV2 {
		t.Errorf("wanted %v got %v", marryV2, w.Body.String())
	}
	headers := w.Header()
	a.cookie = headers.Get("Set-Cookie")
	marryClient = a

	b := larryClient
	w, err = postJSON(b, "/invite", `{"invitee":"marry@mail.com","league":1}`, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}
	want := `{"id":6,"name":"marry","email":"marry@mail.com"}`
	if w.Body.String() != want {
		t.Errorf("want %v got %v", want, w.Body.String())
	}
	body := `{"league":1,"team":"Marry Christmas"}`
	w, err = postJSON(a, "/joinleague", body, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}
	want = `{"ok":true}`
	if w.Body.String() != want {
		t.Errorf("want %v got %v", want, w.Body.String())
	}
}

func TestLeagueHome(t *testing.T) {
	w := httptest.NewRecorder()
	a := larryClient
	req, err := http.NewRequest("GET", "/league/home/1", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("want %v got %v", http.StatusOK, w.Code)
	}
	//Beyond how unwieldy this gets, we really want to track changes to this page as we have users join.
	//There's probably a better way that's eluding me at the moment, but for some larger tests (like a max size league)
	//We're going to want to compare views in a programmatic way.
	want := `{"invites":null,"league":{"ID":1,"Name":"All Arry League","Commissioner":{"id":1,"name":"larry","email":"larry@mail.com"},"State":"INIT","MaxOwner":4,"Kind":"TRAD"},"teams":[{"ID":1,"Name":"Lawrence of Arry-bia","Manager":{"id":1,"name":"larry","email":"larry@mail.com"}},{"ID":2,"Name":"Barry good, Barry barry barry good","Manager":{"id":5,"name":"barry","email":"barry@mail.com"}},{"ID":3,"Name":"Marry Christmas","Manager":{"id":6,"name":"marry","email":"marry@mail.com"}}]}`
	if want != w.Body.String() {
		t.Errorf("want %v", want)
		t.Errorf("got %v", w.Body.String())
	}
}

func TestChangeSetting(t *testing.T) {
	a := larryClient
	newLeagueSettings := `{"league":1,"name":"Very Arry League","maxOwner":3,"kind":"TRAD"}`
	w, err := postJSON(a, "/leaguesettings", newLeagueSettings, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}
	if newLeagueSettings != w.Body.String() {
		t.Errorf("want %v got %v", newLeagueSettings, w.Body.String())
	}

}

func TestLockLeague(t *testing.T) {
	a := larryClient
	w, err := postJSON(a, "/lockleague", `{"league":1}`, http.StatusOK)
	if err != nil {
		t.Fatal(err)
	}
	if w.Body.String() != `{"state":"DRAFT"}` {
		t.Errorf(`want {"state": "DRAFT"} got %v`, w.Body.String())
	}
}

func TestGetDraftSettings(t *testing.T) {
	a := larryClient
	w := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/league/settings/getdraft/1", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("want %v got %v", http.StatusOK, w.Code)
	}
	want := `{"draft":{"ID":1,"Kind":"TRAD","DraftOrder":"SNAKE","Time":"0001-01-01T00:00:00Z","DraftClock":0,"Rounds":15},"positional":{"ID":1,"Kind":"TRAD","QB":1,"RB":2,"WR":2,"TE":1,"Flex":1,"Bench":6,"Superflex":0,"Def":1,"K":1},"scoring":{"offense":{"ID":1,"PassAttempt":0,"PassCompletion":0,"PassYard":0.04,"PassTouchdown":6,"PassInterception":-3,"PassSack":0,"RushAttempt":0,"RushYard":0.1,"RushTouchdown":6,"ReceivingTarget":0,"Reception":0,"ReceivingYard":0.1,"ReceivingTouchdown":6,"Fumble":-1,"FumbleLost":-2,"MiscTouchdown":6,"TwoPointConversion":2,"TwoPointPass":2},"defense":{"ID":1,"Touchdown":6,"Sack":1,"Interception":3,"Safety":2,"Shutout":10,"Points6":7,"Points13":4,"Points20":1,"Points27":0,"Points34":-1,"Points35":-4,"YardBonus":3,"Yards":-0.01},"special":{"ID":1,"Fg29":3,"Fg39":3,"Fg49":3,"Fg50":3,"ExtraPoint":1}}}`
	if want != w.Body.String() {
		t.Errorf("want %v", want)
		t.Errorf("got %v", w.Body.String())
	}
}

//set draft clock:1, superflex:1, passtouchdown:8, yardbonus:5, extrapoint:2
func TestSetDraftSettings(t *testing.T) {
	a := larryClient

	w, err := postJSON(a,
		"/league/settings/setdraft/1",
		`{"draft":{"ID":1,"Kind":"TRAD","DraftOrder":"SNAKE","Time":"0001-01-01T00:00:00Z","DraftClock":1,"Rounds":15},"positional":{"ID":1,"Kind":"TRAD","QB":1,"RB":2,"WR":2,"TE":1,"Flex":1,"Bench":6,"Superflex":1,"Def":1,"K":1},"scoring":{"offense":{"ID":1,"PassAttempt":0,"PassCompletion":0,"PassYard":0.04,"PassTouchdown":8,"PassInterception":-3,"PassSack":0,"RushAttempt":0,"RushYard":0.1,"RushTouchdown":6,"ReceivingTarget":0,"Reception":0,"ReceivingYard":0.1,"ReceivingTouchdown":6,"Fumble":-1,"FumbleLost":-2,"MiscTouchdown":6,"TwoPointConversion":2,"TwoPointPass":2},"defense":{"ID":1,"Touchdown":6,"Sack":1,"Interception":3,"Safety":2,"Shutout":10,"Points6":7,"Points13":4,"Points20":1,"Points27":0,"Points34":-1,"Points35":-4,"YardBonus":5,"Yards":-0.01},"special":{"ID":1,"Fg29":3,"Fg39":3,"Fg49":3,"Fg50":3,"ExtraPoint":2}}}`,
		http.StatusOK)
	if err != nil {
		t.Errorf("bad request: %v", err)
	}
	want := `{"ok":true}`
	if want != w.Body.String() {
		t.Errorf("want %v got %v", want, w.Body.String())
	}
	w = httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/league/settings/getdraft/1", nil)
	if err != nil {
		t.Fatalf("Bad Request: %v", err)
	}
	req.Header.Add("Cookie", a.cookie)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("want %v got %v", http.StatusOK, w.Code)
	}
	want = `{"draft":{"ID":1,"Kind":"TRAD","DraftOrder":"SNAKE","Time":"0001-01-01T00:00:00Z","DraftClock":1,"Rounds":15},"positional":{"ID":1,"Kind":"TRAD","QB":1,"RB":2,"WR":2,"TE":1,"Flex":1,"Bench":6,"Superflex":1,"Def":1,"K":1},"scoring":{"offense":{"ID":1,"PassAttempt":0,"PassCompletion":0,"PassYard":0.04,"PassTouchdown":8,"PassInterception":-3,"PassSack":0,"RushAttempt":0,"RushYard":0.1,"RushTouchdown":6,"ReceivingTarget":0,"Reception":0,"ReceivingYard":0.1,"ReceivingTouchdown":6,"Fumble":-1,"FumbleLost":-2,"MiscTouchdown":6,"TwoPointConversion":2,"TwoPointPass":2},"defense":{"ID":1,"Touchdown":6,"Sack":1,"Interception":3,"Safety":2,"Shutout":10,"Points6":7,"Points13":4,"Points20":1,"Points27":0,"Points34":-1,"Points35":-4,"YardBonus":5,"Yards":-0.01},"special":{"ID":1,"Fg29":3,"Fg39":3,"Fg49":3,"Fg50":3,"ExtraPoint":2}}}`
	if want != w.Body.String() {
		t.Errorf("want %v", want)
		t.Errorf("got %v", w.Body.String())
	}
}

// func TestGetScoringSettings(t *testing.T) {
// 	a := larryClient
// 	w := httptest.NewRecorder()
// 	req, err := http.NewRequest("GET", "/league/settings/getscor/1", nil)
// 	if err != nil {
// 		t.Fatalf("Bad Request: %v", err)
// 	}
// 	req.Header.Add("Cookie", a.cookie)
// 	r.ServeHTTP(w, req)
// 	if w.Code != http.StatusOK {
// 		t.Errorf("want %v got %v", http.StatusOK, w.Code)
// 	}
// 	want := `{"offense":{"ID":1,"PassAttempt":0,"PassCompletion":0,"PassYard":0.04,"PassTouchdown":6,"PassInterception":-3,"PassSack":0,"RushAttempt":0,"RushYard":0.1,"RushTouchdown":6,"ReceivingTarget":0,"Reception":0,"ReceivingYard":0.1,"ReceivingTouchdown":6,"Fumble":-1,"FumbleLost":-2,"MiscTouchdown":6,"TwoPointConversion":2,"TwoPointPass":2},"defense":{"ID":1,"Touchdown":6,"Sack":1,"Interception":3,"Safety":2,"Shutout":10,"Points6":7,"Points13":4,"Points20":1,"Points27":0,"Points34":-1,"Points35":-4,"YardBonus":3,"Yards":-0.01},"special":{"ID":1,"Fg29":3,"Fg39":3,"Fg49":3,"Fg50":3,"ExtraPoint":1}}`
// 	if want != w.Body.String() {
// 		t.Errorf("want %v", want)
// 		t.Errorf("got %v", w.Body.String())
// 	}
// }

//Set passtouchdown to 10
// func TestSetScoringSettings(t *testing.T) {
// 	a := larryClient
// 	w, err := postJSON(a,
// 		"/league/settings/setscor/1",
// 		`{"offense":{"ID":1,"PassAttempt":0,"PassCompletion":0,"PassYard":0.04,"PassTouchdown":10,"PassInterception":-3,"PassSack":0,"RushAttempt":0,"RushYard":0.1,"RushTouchdown":6,"ReceivingTarget":0,"Reception":0,"ReceivingYard":0.1,"ReceivingTouchdown":6,"Fumble":-1,"FumbleLost":-2,"MiscTouchdown":6,"TwoPointConversion":2,"TwoPointPass":2},"defense":{"ID":1,"Touchdown":6,"Sack":1,"Interception":3,"Safety":2,"Shutout":10,"Points6":7,"Points13":4,"Points20":1,"Points27":0,"Points34":-1,"Points35":-4,"YardBonus":3,"Yards":-0.01},"special":{"ID":1,"Fg29":3,"Fg39":3,"Fg49":3,"Fg50":3,"ExtraPoint":1}}`,
// 		http.StatusOK)
// 	if err != nil {
// 		t.Errorf("bad request: %v", err)
// 	}
// 	want := `{"ok":true}`
// 	if want != w.Body.String() {
// 		t.Errorf("want %v got %v", want, w.Body.String())
// 	}
// 	w = httptest.NewRecorder()
// 	req, err := http.NewRequest("GET", "/league/settings/getscor/1", nil)
// 	if err != nil {
// 		t.Fatalf("Bad Request: %v", err)
// 	}
// 	req.Header.Add("Cookie", a.cookie)
// 	r.ServeHTTP(w, req)
// 	if w.Code != http.StatusOK {
// 		t.Errorf("want %v got %v", http.StatusOK, w.Code)
// 	}
// 	want = `{"offense":{"ID":1,"PassAttempt":0,"PassCompletion":0,"PassYard":0.04,"PassTouchdown":10,"PassInterception":-3,"PassSack":0,"RushAttempt":0,"RushYard":0.1,"RushTouchdown":6,"ReceivingTarget":0,"Reception":0,"ReceivingYard":0.1,"ReceivingTouchdown":6,"Fumble":-1,"FumbleLost":-2,"MiscTouchdown":6,"TwoPointConversion":2,"TwoPointPass":2},"defense":{"ID":1,"Touchdown":6,"Sack":1,"Interception":3,"Safety":2,"Shutout":10,"Points6":7,"Points13":4,"Points20":1,"Points27":0,"Points34":-1,"Points35":-4,"YardBonus":3,"Yards":-0.01},"special":{"ID":1,"Fg29":3,"Fg39":3,"Fg49":3,"Fg50":3,"ExtraPoint":1}}`
// 	if want != w.Body.String() {
// 		t.Errorf("want %v", want)
// 		t.Errorf("got %v", w.Body.String())
// 	}
// }

/*
	HELPERS
*/
//We'll need this for every POST, to respresent individual clients.  The csrf request will get the csrf for a session,
//and then we will use that session to persist accross several requests.
func getCSRF(r *gin.Engine) (a client, err error) {
	w := httptest.NewRecorder()
	req, err := http.NewRequest("GET", "/csrftoken", nil)
	if err != nil {
		return client{}, err
	}
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		return client{}, err
	}
	headers := w.Header()
	return client{w.Body.String(), headers.Get("Set-Cookie")}, nil
}

//All of our POST requests send a JSON.stringified object.
func postJSON(c client, url string, JSONbody string, httpStatus int) (*httptest.ResponseRecorder, error) {
	w := httptest.NewRecorder()
	data := strings.NewReader(JSONbody)
	req, err := http.NewRequest("POST", url, data)
	if err != nil {
		return nil, err
	}
	req.Header.Add("X-CSRF-TOKEN", c.csrf)
	req.Header.Add("Content-Type", "Application/JSON")
	req.Header.Add("Cookie", c.cookie)
	r.ServeHTTP(w, req)
	if w.Code != httpStatus {
		return nil, errors.New("want " +
			strconv.Itoa(httpStatus) +
			" got " +
			strconv.Itoa(w.Code) +
			" cause: " +
			w.Body.String())
	}
	return w, nil
}
