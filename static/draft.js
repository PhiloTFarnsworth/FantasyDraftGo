const { useState, useEffect, useRef, useContext } = React;

function Draft(props) {
    const [draftPool, setDraftPool] = useState([])
    const [draftHistory, setDraftHistory] = useState([])
    const [statHeaders, setStatHeaders] = useState([])
    const [boardFocus, setBoardFocus] = useState('')
    const [playerFocus, setPlayerFocus] = useState({})
    const [teamFocus, setTeamFocus] = useState('')
    const [lastSort, setLastSort] = useState('')
    const [currentPick, setCurrentPick] = useState(0)
    const [teamStatus, setTeamStatus] = useState([])
    const [loading, setLoading] = useState(true)
    const draftSocket = useRef(null)
    
    //initializes a team status list
    function prepareStatus() {
        let tempStatus = []
        props.teams.map(team => tempStatus.push({id: team.ID, active: false}))
        setTeamStatus(tempStatus)
    }

    //This useEffect populates some of our states once on load
    useEffect(() => {
        prepareStatus()
        //So we're going to use a websocket to update the draft as it progresses.
        draftSocket.current = new WebSocket(
            'ws://'
            + window.location.host
            + '/ws/draft/'
            + props.leagueID
            + ''
        )
        setLoading(false)
    }, [])

    //This useEffect sets control for our draft socket
    useEffect(() => {
        if (draftSocket !== null) {

            draftSocket.current.onclose = (e) => {
                console.log('Websocket closed unexpectedly')
            }
            draftSocket.current.onopen = (e) => {
                //When we join, all users in the room receive a status message, while the joiner gets
                //a user list.  
            }
            draftSocket.current.onmessage = (e) => {
                let data = JSON.parse(e)
                switch (data.Kind) {
                    //"users" is only sent upon joining a room.  it passes a list of user ids that are
                    //currently in a draft instance
                    case "users":
                        let tempStatus = [...teamStatus]
                        tempStatus.map(team => {
                            if (data.Users.contains(team.id)) {
                                team.active = true
                            }
                        })
                        setTeamStatus(tempStatus)
                        break;
                    case "status":
                        let tempStatus = [...teamStatus]
                        tempStatus.map(team => {
                            if (team.id === data.User) {
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

    function submit(e) {
        e.preventDefault()
        draftSocket.current.send(JSON.stringify({"Kind":"message", "Payload": msg.value}))
    }

    if (loading) {
        return(<div>loading...</div>)
    }

    return(
        <div>
        <div id="fakechat">

        </div>
        <form onSubmit={submit}>
            <input id="msg" type="text" />
            <button type="submit">chat</button>
        </form>
        </div>
    )
}