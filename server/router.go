package server

import (
	"fmt"
	"os"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	csrf "github.com/utrack/gin-csrf"
)

func NewRouter() *gin.Engine {
	r := gin.Default()

	store := cookie.NewStore([]byte("secret"))

	//Multi Room example.  'h' will be our main draft hub
	h := hub{
		rooms:      map[string]map[*connection]bool{},
		broadcast:  make(chan message),
		register:   make(chan subscription),
		unregister: make(chan subscription),
	}
	go h.run()

	r.Use(sessions.Sessions("mysession", store))

	r.Use(csrf.Middleware(csrf.Options{
		Secret: os.Getenv("CSRFSECRET"),
		ErrorFunc: func(c *gin.Context) {
			token := csrf.GetToken(c)
			c.String(400, fmt.Sprintf("CSRF token mismatch: %s", token))
			c.Abort()
		},
	}))

	r.LoadHTMLFiles(os.Getenv("FSGOPATH") + "static/index.html")
	r.Static("/static", os.Getenv("FSGOPATH")+"static")

	//TODO: Refactor these.  names could be better for routes, probably should group everything
	//outside of index as needing authorization (a middleware that checks for session ID?  is that built in?)
	r.GET("/", index)
	r.POST("register", register)
	r.POST("login", login)
	r.GET("logout", logout)
	r.POST("createleague", createLeague)
	r.POST("invite", InviteUser)
	r.GET("leagues", getLeagues)
	r.GET("/league/home/:ID", LeagueHome)
	r.POST("joinleague", joinLeague)
	r.POST("leaguesettings", leagueSettings)
	r.POST("lockleague", lockLeague)
	r.GET("/league/settings/getdraft/:ID", getDraftSettings)
	r.POST("/league/settings/setdraft/:ID", setDraftSettings)
	r.GET("/league/settings/getscor/:ID", getScoringSettings)
	//r.POST("/league/settings/setscor/:ID", setScoringSettings)
	r.POST("startdraft", startDraft)
	r.GET("draftpool", DraftPool)
	r.GET("/league/draft/:ID", draftHistory)

	//Websocket
	r.GET("/ws/draft/:ID", func(c *gin.Context) {
		serveWs(c, h)
	})

	return r
}
