const { useState, useEffect, useRef, useContext } = React;

const ALPHA = 'abcdefghijklmnopqrstuvwxyz'

//History = [{Slot: int, Player: ID, Team: ID}]

function Draft(props) {
    const [draftPool, setDraftPool] = useState([])
    const [draftHistory, setDraftHistory] = useState([])
    const [statHeaders, setStatHeaders] = useState([])
    const [boardFocus, setBoardFocus] = useState({context: "summary"})
    const [lastSort, setLastSort] = useState('')
    const [currentPick, setCurrentPick] = useState(0)
    const [userStatus, setUserStatus] = useState([])
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
            for (let i = 0; i < data.Players.length; i++) {
                draftClass.push(data.Players[i])
                if (i === 0) {
                    let rawHeaders = Object.keys(data.Players[i])
                    for (let j = 0; j < rawHeaders.length; j++) {
                        //We store our headers as their verbose names, but it would be useful to carry an 
                        //abbreviation along with the full name.  Our database structure is a little different
                        //from our python implementation (mostly trying to find a sweet spot on how verbose to 
                        //be in the database + the different rules for marshalling objects into json).
                        let abbreviation = ""
                        let verbose = ""
                        let indices = []
                        for (let k = 0; k < rawHeaders[j].length; k++) {
                            //Not a huge fan of this, but it will work for english.  
                            if (rawHeaders[j].charAt(k) === rawHeaders[j].charAt(k).toUpperCase()) {
                                abbreviation = abbreviation.concat(rawHeaders[j].charAt(k))    
                                indices.push(k)
                            }
                        }

                        if (indices.length === rawHeaders[j].length) {
                            //ID is an example, though we won't expose that to users.  
                            verbose = rawHeaders[j]
                        } else {
                            //split on our capital letter indices, adding a space before them to make our verbose strings
                            //more readable. 
                            for (let k = 0; k < indices.length; k++) {
                                if (k + 1 < indices.length ) {
                                    verbose = verbose.concat(rawHeaders[j].slice(indices[k], indices[k+1]), " ")
                                } else {
                                    //slice k to end
                                    verbose = verbose.concat(rawHeaders[j].slice(indices[k]))
                                }
                            }
                        }
                        headers.push({verbose: verbose, abbreviation: abbreviation, raw: rawHeaders[j]})
                        }
                    }
                }
            setStatHeaders(headers)
            setDraftPool(draftClass)
        })
        .catch(error => Notify(error, 0))
    }

    //This useEffect populates some of our states once on load
    useEffect(() => {
        fetchDraftHistory()
        fetchDraftPool()
        if (draftHistory.length > 0) {
            //remove drafted players from draft pool
            let pool = [...draftPool]
            draftHistory.map(pick => {
                let index = pool.findIndex(player => player.ID === pick.Player)
                pool.splice(index, 1)
            })
            setDraftPool(pool)
        }
        //So we're going to use a websocket to update the draft as it progresses.
        draftSocket.current = new WebSocket(
            'ws://'
            + window.location.host
            + '/ws/draft/'
            + props.league.ID
            + '?userID='
            + User.ID
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
                let data = JSON.parse(e.data)
                switch (data.Kind) {
                    //"users" is only sent upon joining a room.  it passes a list of user ids that are
                    //currently in a draft instance
                    case "users": {
                        //create a temp status, with all teams managers ids and an active false
                        let tempStatus = props.teams.map(team => {return {ID: team.Manager.ID, active: false}})
                        tempStatus.forEach(user => {
                            if (data.Users.includes(user.ID)) {
                                user.active = true
                            }
                        })
                        setUserStatus(tempStatus)
                        break;
                    }
                    case "status":
                        {
                        let tempStatus = [...userStatus]
                        tempStatus.forEach(user => {
                            if (user.ID === data.User) {
                                user.active = data.Active
                            }
                        })
                        setUserStatus(tempStatus)
                        break;
                    }
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
        for (const [key, value] of Object.entries(draftPool[0])) {
            if (key === header) {
                let chars = String(value).toLowerCase().split('')
                if (ALPHA.includes(chars[0])) {
                    // Alpha sort
                    if (lastSort !== header) {
                        sortedPool.sort((a,b) => a[key].toString().localeCompare(b[key].toString()))
                        setLastSort(header)
                    } else {
                        sortedPool.sort((a,b) => b[key].toString().localeCompare(a[key].toString()))
                        setLastSort('')
                    }
                    setDraftPool(sortedPool)
                } else {
                    // Number sort
                    if (lastSort !== header) {
                        sortedPool.sort((a,b) => b[key] - a[key])
                        setLastSort(header)
                    } else {
                        sortedPool.sort((a,b) => a[key] - b[key])
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
        <DraftPool 
        players={draftPool} 
        headers={statHeaders} 
        tableSort={sortDraftPool} 
        shiftFocus={shiftFocus} />
        <DraftBoard 
        focus={boardFocus}
        history={draftHistory}
        players={draftPool}
        shiftFocus={shiftFocus}
        selectPlayer={submitPick}
        currentPick={currentPick}
        teams={props.teams}
        />
        </div>
        
    )
}

function DraftPool(props) {
    const passing = [
        'PassCompletions',
        'PassAttempts',
        'PassYards',
        'PassInterceptions'
    ]
    const rushing = [
        'RushAttempts',
        'RushYards',
        //'rushing_yards_per_attempt_YPA',  -I guess I excised this
    ]
    const receiving = [
        'Targets',
        'Receptions',
        'ReceivingYards',
        //'receiving_yards_per_catch_YPC', -Another casualty
    ]
    const miscScoring = [
        'TwoPointConversion',
        'TwoPointPass'
    ]
    const fantasy = [
        'PointPerReception',
        //'fantasy_DK_DK',
        //'fantasy_FD_FD', - gone but not forgotten
    ]
    const general = [
        'Age',
        'Team',
        'Games',
        'Starts',
    ]
     const defaultFields = [
         'Position',
         'Name',
         'PassTouchdowns',
         'RushTouchdowns',
         'ReceivingTouchdowns',
         'FantasyPoints',
         'ValueBased'
    ]
    const [expandables, setExpandables] = useState(defaultFields)
    const [passSpan, setPassSpan] = useState(1)
    const [rushSpan, setRushSpan] = useState(1)
    const [recSpan, setRecSpan] = useState(1)
    const [fantSpan, setFantSpan] = useState(2)
    const [generalSpan, setGeneralSpan] = useState(2)


    const HandleSort = (e) => {
        e.preventDefault()
        props.tableSort(e.currentTarget.id)
    }

    const HandleFocus = (e) => {
        e.preventDefault()
        props.shiftFocus({'context': 'player', 'ID': e.target.parentElement.id})
    }

    //list comprehensions would be nice here, but this resolves alright.
    const expandStats = (e) => {
        switch(e.target.id) { 
        case 'general_x':
            if (general.every(category => expandables.includes(category))) { 
                setExpandables([...expandables].filter((category) => !general.includes(category))) 
                setGeneralSpan(2)
            } else {
                setExpandables([...expandables].concat(general))
                setGeneralSpan(general.length + 2)
            }
            break
        case 'pass_x':
            if (passing.every(category => expandables.includes(category))) { 
                setExpandables([...expandables].filter((category) => !passing.includes(category))) 
                setPassSpan(1)
            } else {
                setExpandables([...expandables].concat(passing))
                setPassSpan(passing.length + 1)
            }
            break
        case 'rush_x':
            if (rushing.every(category => expandables.includes(category))) { 
                setExpandables([...expandables].filter((category) => !rushing.includes(category))) 
                setRushSpan(1)
            } else {
                setExpandables([...expandables].concat(rushing))
                setRushSpan(rushing.length + 1)
            }
            break
        case 'rec_x':
            if (receiving.every(category => expandables.includes(category))) {
                setExpandables([...expandables].filter((category) => !receiving.includes(category))) 
                setRecSpan(1)
            } else {
                setExpandables([...expandables].concat(receiving))
                setRecSpan(receiving.length + 1)
            }
            break
        case 'misc_x':
            miscScoring.every(category => expandables.includes(category)) ?
            setExpandables([...expandables].filter((category) => !miscScoring.includes(category))) : 
            setExpandables([...expandables].concat(miscScoring))
            break
        case 'fant_x':
            if (fantasy.every(category => expandables.includes(category))) { 
                setExpandables([...expandables].filter((category) => !fantasy.includes(category))) 
                setFantSpan(2)
            } else {
                setExpandables([...expandables].concat(fantasy))
                setFantSpan(fantasy.length + 2)
            }
            break
        }
    }

    return(
        <div className='table-responsive overflow-auto'>
        <table className='table table-bordered border-success table-hover table-sm text-center'>
            <caption>Draft Pool</caption>
            <thead>
                <tr>
                    <td colSpan={generalSpan}>
                        <div className='d-grid gap-2'>
                            <button className='btn btn-success btn-sm' onClick={expandStats} id='general_x'> General </button>
                        </div>
                    </td>
                    <td colSpan={passSpan}>
                        <div className='d-grid gap-2'>
                            <button className='btn btn-success btn-sm' onClick={expandStats} id='pass_x'> Passing </button>
                        </div>
                    </td>
                    <td colSpan={rushSpan}>
                        <div className='d-grid gap-2'>
                            <button className='btn btn-success btn-sm' onClick={expandStats} id='rush_x'> Rushing </button>
                        </div>
                    </td>
                    <td colSpan={recSpan}>
                        <div className='d-grid gap-2'>
                            <button className='btn btn-success btn-sm' onClick={expandStats} id='rec_x'> Receiving </button>
                        </div>
                    </td>
                    {/* <td><button onClick={expandStats} id='misc_x'> Misc </button></td> */}
                    <td colSpan={fantSpan}>
                        <div className='d-grid gap-2'>
                            <button className='btn btn-success btn-sm' onClick={expandStats} id='fant_x'> Fantasy </button>
                        </div>
                    </td>
                </tr>
                <tr key='headers'>
                    {props.headers.map((header) => {
                        //We need to split our headers on the underscores.  If the can be split, then the final
                        //string will be its abbreviation, while the rest of the strings are the full name.
                        if (header.verbose === 'Pfbr Name') {
                            return
                        } else {
                            if (expandables.includes(header.raw)){
                                return <th key={header.raw + "_key"} scope='col'><div className='d-grid gap-2'><button className="btn btn-warning btn-sm" id={header.raw} onClick={HandleSort}>{header.abbreviation}</button></div></th>
                            }
                        }
                    })}
                </tr>
            </thead>
            <tbody>
            {props.players.map((player) => 
                <tr key={player.PfbrName} onClick={HandleFocus} id={player.ID}>
                    {Object.values(player).map((stat, index) => {
                        //We should have a key for this value, probably a confab of code_name and the stat header.  But since we're 
                        //Not going to update scores in this version we'll leave be for the moment.
                        let code = Object.keys(player)
                        let name_code = Object.values(player)
                        if (expandables.includes(code[index])) {
                            return index === 0 ? 
                            <th scope='row' key={code[index]+' '+name_code[1]} >{stat}</th> 
                            : <td key={code[index]+' '+name_code[1]}>{stat}</td>
                        }
                    })}
                </tr>
            )}
            </tbody>
        </table>
        </div>
    )
}


