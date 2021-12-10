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

	r.Use(sessions.Sessions("mysession", store))

	r.Use(csrf.Middleware(csrf.Options{
		Secret: os.Getenv("CSRFSECRET"),
		ErrorFunc: func(c *gin.Context) {
			token := csrf.GetToken(c)
			c.String(400, fmt.Sprintf("CSRF token mismatch: %s", token))
			c.Abort()
		},
	}))

	r.LoadHTMLFiles("./static/index.html")
	r.Static("/static", "./static")

	r.GET("/", index)
	r.POST("register", register)
	r.POST("login", login)
	r.GET("logout", logout)
	r.POST("createleague", createLeague)
	r.POST("invite", InviteUser)
	r.GET("/user/leagues/:id", getLeagues)
	r.GET("/league/home/:id", LeagueHome)
	r.POST("joinleague", joinLeague)
	r.POST("leagueSettings", leagueSettings)
	r.POST("lockLeague", lockLeague)
	return r
}
