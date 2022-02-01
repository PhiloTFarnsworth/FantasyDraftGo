package server

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/PhiloTFarnsworth/FantasySportsAF/store"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

//We're going to model our socket implementation off of gorilla's chat app.  So we'll define a
//hub with all the functions we can do on the hub.  We'll support a chat feature during the draft
//in this iteration, so we can build off a typical chat app, then add a specific communication
//for a draft selection.

//https://github.com/gorilla/websocket/issues/46 <- example here of a multi room chat app.

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512
)

// connection is an middleman between the websocket connection and the hub.
type connection struct {
	// The websocket connection.
	ws *websocket.Conn

	//The user that opened the connection
	user int64

	// Buffered channel of outbound messages.
	send chan []byte
}

//represents a single client in a single room
type subscription struct {
	conn *connection
	room string
}

//We'll keep message from the example for our chat.
type message struct {
	data []byte
	room string
}

type chat struct {
	Kind    string
	Payload string
}

//We could conceivably pass all this information along the message struct (see the python implementation),
//but I think we get a benefit out of creating a different channel for different functions.
type draftPick struct {
	player int64
	pick   int64
	team   int64
	league int64
	room   string
}

//Status will inform the room whether a user has entered or left a draft instance.  This could be expanded further to include
//functionality like varying states of being in a room (like an "away" status), but for now we'll keep it simple
type status struct {
	Kind   string
	User   int64
	Active bool
}

// hub maintains the set of active connections and broadcasts messages to the
// connections.
type hub struct {
	// Registered connections.
	rooms map[string]map[*connection]bool

	// Inbound messages from the connections.
	broadcast chan message

	// Register requests from the connections.
	register chan subscription

	// Unregister requests from connections.
	unregister chan subscription

	pick chan draftPick
}

func newHub() *hub {
	return &hub{
		rooms:      map[string]map[*connection]bool{},
		broadcast:  make(chan message),
		register:   make(chan subscription),
		unregister: make(chan subscription),
		pick:       make(chan draftPick),
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// readPump pumps messages from the websocket connection to the hub.
func (s subscription) readPump(h hub) {
	c := s.conn
	defer func() {
		h.unregister <- s
		c.ws.Close()
	}()
	c.ws.SetReadLimit(maxMessageSize)
	c.ws.SetReadDeadline(time.Now().Add(pongWait))
	c.ws.SetPongHandler(func(string) error { c.ws.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	//Alright, so first step is we want to check what we are reading.  Because we're working a fair bit with
	//JSON, I think the answer is to send all messages as json strings, with a type and a payload.  We'll
	//use the type specified to interpret the payload.
	for {
		_, msg, err := c.ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Printf("error: %v", err)
			}
			break
		}

		var decoded struct {
			Kind    string
			Payload json.RawMessage
		}
		err = json.Unmarshal(msg, &decoded)
		if err != nil {
			fmt.Println(err)
		}

		switch decoded.Kind {
		case "message":
			//Cut off the quotes from Payload and pass as a message.
			m := message{[]byte(decoded.Payload[1 : len(decoded.Payload)-1]), s.room}
			h.broadcast <- m
		case "pick":
			var n struct {
				Player int64
				Pick   int64
				Team   int64
				League int64
			}
			err = json.Unmarshal(decoded.Payload, &n)
			if err != nil {
				fmt.Println(err)
			}
			p := draftPick{n.Player, n.Pick, n.Team, n.League, s.room}
			h.pick <- p
		}
	}
}

// write writes a message with the given message type and payload.
func (c *connection) write(mt int, payload []byte) error {
	c.ws.SetWriteDeadline(time.Now().Add(writeWait))
	return c.ws.WriteMessage(mt, payload)
}

// writePump pumps messages from the hub to the websocket connection.  We're going to marshall any
// complex data before we send it to the write pump, so this is left unaltered
func (s *subscription) writePump() {
	c := s.conn
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.ws.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.write(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.write(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.write(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		}
	}
}

// serveWs handles websocket requests from the peer.  Adapted to take a *gin.Context
func serveWs(c *gin.Context, h hub) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println(err)
		return
	}
	leagueID := c.Param("ID")
	userID, err := strconv.ParseInt(c.Query("userID"), 10, 64)
	if err != nil {
		log.Println(err)
		return
	}
	conn := &connection{send: make(chan []byte, 256), ws: ws, user: userID}
	s := subscription{conn, leagueID}
	h.register <- s
	go s.writePump()
	s.readPump(h)
}

func (h *hub) run() {
	for {
		select {
		//indicate user has joined draft
		case s := <-h.register:
			//get room, create if does not exist
			connections := h.rooms[s.room]
			if connections == nil {
				connections = make(map[*connection]bool)
				h.rooms[s.room] = connections
			}
			h.rooms[s.room][s.conn] = true
			//user has joined room.  We want to send a message to all connections informing that the user joined the room as well as poll for all connections
			//in the room.  We then pass all the active connections to the back to the originating user.  We can just pass a list of user ids since we can access
			//their user info from the team info passed into the league prop.
			u := status{Kind: "status", User: s.conn.user, Active: true}
			b, err := json.Marshal(u)
			if err != nil {
				fmt.Println(err)
				return
			}

			var userList struct {
				Kind  string
				Users []int64
			}
			userList.Kind = "users"

			//Pass to all non originating connections, build user list
			for c := range connections {
				if c.user != s.conn.user {
					c.send <- b
				}
				userList.Users = append(userList.Users, c.user)
			}
			b, err = json.Marshal(userList)
			if err != nil {
				fmt.Println(err)
				return
			}
			//send userlist to originating user
			s.conn.send <- b

		case s := <-h.unregister:
			//indicate user has left draft then close
			connections := h.rooms[s.room]
			if connections != nil {
				if _, ok := connections[s.conn]; ok {
					delete(connections, s.conn)
					close(s.conn.send)
					if len(connections) == 0 {
						delete(h.rooms, s.room)
					} else {
						//If there are still open connections, pass a notification that this connection is closing
						u := status{Kind: "status", User: s.conn.user, Active: false}
						b, err := json.Marshal(u)
						if err != nil {
							fmt.Println(err)
							return
						}

						for c := range connections {
							c.send <- b
						}
					}
				}
			}
		case m := <-h.broadcast:
			p := chat{Kind: "chat", Payload: string(m.data[:])}
			b, err := json.Marshal(p)
			if err != nil {
				fmt.Println(err)
				return
			}
			connections := h.rooms[m.room]
			for c := range connections {
				select {
				case c.send <- b:
				default:
					close(c.send)
					delete(connections, c)
					if len(connections) == 0 {
						delete(h.rooms, m.room)
					}
				}
			}
		case p := <-h.pick:
			//First deal with the database
			db := store.GetDB()

			tx, err := db.Begin()
			if err != nil {
				fmt.Println(err)
			}

			draftTable := "draft_" + strconv.FormatInt(p.league, 10)
			newPick, err := db.Exec("INSERT INTO "+draftTable+" (ID, player, team) VALUES (?,?,?)", p.pick, p.player, p.team)
			if err != nil {
				fmt.Println(err)
				tx.Rollback()
			}

			pickIdentity, err := newPick.LastInsertId()
			if err != nil {
				fmt.Println(err)
				tx.Rollback()
			}
			if pickIdentity != p.pick {
				//make sure that the pick's ID == the order of picks, otherwise we got some desync error
				//That we should've prevented on the frontend
				tx.Rollback()
			}

			if err = tx.Commit(); err != nil {
				fmt.Print(err)
			}

			//What do we want to broadcast?  That the player has been taken by a team at a certain pick.
			var thisPick struct {
				Kind   string
				Player int64
				Team   int64
				Pick   int64
			}
			thisPick.Kind = "draft"
			thisPick.Pick = p.pick
			thisPick.Player = p.player
			thisPick.Team = p.team
			b, err := json.Marshal(thisPick)
			if err != nil {
				fmt.Println(err)
			}
			//Then broadcast back to the other clients in room
			connections := h.rooms[p.room]
			for c := range connections {
				select {
				case c.send <- b:
				//timeout
				default:
					close(c.send)
					delete(connections, c)
					if len(connections) == 0 {
						delete(h.rooms, p.room)
					}
				}
			}
		}
	}
}
