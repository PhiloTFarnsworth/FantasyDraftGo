const { useState, useEffect, useRef, useContext } = React;

function Draft(props) {
    const [draftPool, setDraftPool] = useState([])
    const [draftHistory, setDraftHistory] = useState([])
    const [statHeaders, setStatHeaders] = useState([])
    const [boardFocus, setBoardFocus] = useState({context: "summary"})
    const [lastSort, setLastSort] = useState('')
    const [currentPick, setCurrentPick] = useState(0)
    const [teamStatus, setTeamStatus] = useState([])
    const [loading, setLoading] = useState(true)
    const draftSocket = useRef(null)
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)

    //To start, we want to fetch our draft history and draft class.  While these could be gathered from
    //our initial websocket connection or as a single request, I can see a scenario where we want to have 
    //a draft class preview before a draft, as well as an accessible draft history after the draft.     

    function fetchDraftHistory() {
        fetch("/league/draft/" + props.league.ID, { method: "GET" })
        .then(response => response.json())
        .then(data => {
            let history = []
            data.map(pick => history.push(pick))
            setDraftHistory(history)
        })
        .catch(error => Notify(error, 0))
    }

    function fetchDraftPool() {
        fetch("/draftpool", { method: "GET" })
        .then(response => response.json())
        .then(data => {
            let draftClass = []
            let headers = []    
            data.map((player, index) => {
                draftClass.push(player)
                if (index === 0) {
                    Object.keys(player.fields).map((header) => {
                        //We store our headers as their verbose names, but it would be useful to carry an 
                        //abbreviation along with the full name.  Our database structure is a little different
                        //from our python implementation (mostly trying to find a sweet spot on how verbose to 
                        //be in the database + the different rules for marshalling objects into json).
                        let abbreviation = ""
                        let verbose = ""
                        let indices = []
                        for (let i = 0; i < header.length; i++) {
                            if (header.charAt(i) === header.charAt(i).toUpperCase()) {
                                abbreviation.concat(header.charAt(i))
                                //We'll save indices for capital letters beyond the first
                                if (i != 0) {
                                    indices.push(i)
                                }
                            }
                        }
                        //split on our capital letter indices, adding a space before them to make our verbose strings
                        //more readable. start is the first index, after we concat that we set start to the new index, and
                        //offset by the number of spaces we have added
                        let start = 0
                        indices.map((cap, i) => {
                            verbose.concat(header.slice(start+i, cap), " ")
                            start = cap
                        })
                        headers.push({verbose: verbose, abbreviation: abbreviation})
                        }
                    )
                }
            })
            setStatHeaders(headers)
            setDraftPool(draftClass)
        })
        .catch(error => Notify(error, 0))
    }

    //initializes a team status list
    function prepareStatus() {
        let tempStatus = []
        props.teams.map(team => tempStatus.push({ID: team.ID, active: false}))
        setTeamStatus(tempStatus)
    }

    //This useEffect populates some of our states once on load
    useEffect(() => {
        fetchDraftHistory()
        fetchDraftPool()
        if (history.length > 0) {
            //remove drafted players from draft pool
            let pool = [...draftPool]
            draftHistory.map(pick => {
                let index =  pool.findIndex(player => player.ID === pick.Player)
                pool.splice(index, 1)
            })
            setDraftPool(pool)
        }
        prepareStatus()
        //So we're going to use a websocket to update the draft as it progresses.
        draftSocket.current = new WebSocket(
            'ws://'
            + window.location.host
            + '/ws/draft/'
            + props.league.ID
            + ''
        )
        setLoading(false)
    }, [])

    //This useEffect sets control for our draft socket.  We want it to update not only when the 'draftsocket'
    //transitions from null, but we want to update this anytime we have a state change on any states we access
    //within this controller.  
    useEffect(() => {
        if (draftSocket !== null) {

            draftSocket.current.onclose = (e) => {
                console.log('Websocket closed unexpectedly')
            }
            draftSocket.current.onopen = (e) => {
                //When we join, all users in the room receive a status message, while the joiner gets
                //a user list.  So we probably don't need this...  
            }
            draftSocket.current.onmessage = (e) => {
                let data = JSON.parse(e)
                switch (data.Kind) {
                    //"users" is only sent upon joining a room.  it passes a list of user ids that are
                    //currently in a draft instance
                    case "users":
                        let tempStatus = [...teamStatus]
                        tempStatus.map(team => {
                            if (data.Users.contains(team.ID)) {
                                team.active = true
                            }
                        })
                        setTeamStatus(tempStatus)
                        break;
                    case "status":
                        let tempStatus = [...teamStatus]
                        tempStatus.map(team => {
                            if (team.ID === data.User) {
                                team.active = data.Active
                            }
                        })
                        setTeamStatus(tempStatus)
                        break;
                    case "draft":
                        console.log(data)
                        break;
                    case "chat":
                        var item = document.createElement("div")
                        item.innerHTML = e.data
                        var chat = document.getElementById("fakechat")
                        chat.appendChild(item)
                        break;
                    default:
                        console.log("sent " + data.Kind + " message type, why did you do that?")
                        break;
                }
            }
        }
    }, [draftSocket])

    function submitChat(e) {
        e.preventDefault()
        draftSocket.current.send(JSON.stringify({"Kind":"message", "Payload": msg.value}))
    }

    function submitPick(playerID) {
        e.preventDefault()
        let team = 0
        for (let i = 0; i < props.teams.length; i++) {
            if (props.teams[i].Manager.ID === User.ID) {
                team = teams[i].ID
                break;
            }
        }
        draftSocket.current.send(JSON.stringify({"Kind":"pick", "Payload":{"Player": playerID, "Pick":currentPick, "Team":team, "League": props.league.ID}}))
    }

    function shiftFocus(focusable) {
        e.preventDefault()
        switch (focusable.context) {
            case "player":
                setBoardFocus({context:"player", ID:focusable.ID})
                break;
            case "team":
                setBoardFocus({context:"team", ID:focusable.ID})
                break;
            default:
                setBoardFocus({context:"summary"})
                break;
        }
    }

    function sortDraftPool(header) {
        let sortedPool = [...draftPool]
        for (const [key, value] of Object.entries(draftPool[0].fields)) {
            if (key === header) {
                let chars = String(value).toLowerCase().split('')
                if (ALPHA.includes(chars[0])) {
                    // Alpha sort
                    if (lastSort !== header) {
                        sortedPool.sort((a,b) => a.fields[key].toString().localeCompare(b.fields[key].toString()))
                        setLastSort(header)
                    } else {
                        sortedPool.sort((a,b) => b.fields[key].toString().localeCompare(a.fields[key].toString()))
                        setLastSort('')
                    }
                    setDraftPool(sortedPool)
                } else {
                    // Number sort
                    if (lastSort !== header) {
                        sortedPool.sort((a,b) => b.fields[key] - a.fields[key])
                        setLastSort(header)
                    } else {
                        sortedPool.sort((a,b) => a.fields[key] - b.fields[key])
                        setLastSort('')
                    }
                    setDraftPool(sortedPool)
                }
                break
            }
        }    
    }


    if (loading) {
        return(<div>loading...</div>)
    }

    return(
        <div>
        <div id="fakechat">

        </div>
        <form onSubmit={submitChat}>
            <input id="msg" type="text" />
            <button type="submit">chat</button>
        </form>
        </div>
    )
}