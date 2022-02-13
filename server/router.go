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

	h := newHub()
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

	//basic User paths
	r.GET("/", index)
	r.POST("register", register)
	r.POST("login", login)
	r.GET("logout", logout)
	r.GET("leagues", getLeagues)
	//league paths With more time, I'd probably move league into a session, so
	//that you hop back into your last league.  That would likely require some
	//redesign to allow users to view their leagues and change between them easily.
	r.POST("/league/create", createLeague)
	r.POST("/league/invite", InviteUser)
	r.POST("/league/revokeInvite", revokeInvite)
	r.GET("/league/home/:ID", LeagueHome)
	r.POST("/league/editTeam", editTeamInfo)
	r.POST("/league/join", joinLeague)
	r.POST("/league/settings", leagueSettings)
	r.POST("/league/lock", lockLeague)
	r.GET("/league/settings/getdraft/:ID", getDraftSettings)
	r.POST("/league/settings/setdraft/:ID", setDraftSettings)
	r.GET("/league/settings/getscor/:ID", getScoringSettings)
	r.POST("/league/startdraft", startDraft)
	r.GET("/league/draft/:ID", draftHistory)
	r.GET("draftpool", DraftPool)

	//Websocket
	r.GET("/ws/draft/:ID", func(c *gin.Context) {
		serveWs(c, *h)
	})

	return r
}
