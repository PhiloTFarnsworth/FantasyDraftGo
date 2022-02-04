'use strict'
import React, { useState, useEffect, useRef, useContext } from 'react';
import { UserContext, NotifyContext } from './util.js';
const ALPHA = 'abcdefghijklmnopqrstuvwxyz'
const ROUNDS = 15

//History = [{Slot: int, Player: ID, Team: ID}]

function Draft(props) {
    const [draftPool, setDraftPool] = useState([])
    const [availablePlayers, setAvailablePlayers] = useState([])
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

    useEffect(() => {
        fetchDraftHistory()
        fetchDraftPool()
        
        //So we're going to use a websocket to update the draft as it progresses.
        draftSocket.current = new WebSocket(
            'ws://'
            + window.location.host
            + '/ws/draft/'
            + props.league.ID
            + '?userID='
            + User.ID
        )
    }, [])

    //the first rule of building something is getting it to work.  For now, we check if draftpool and
    //drafthistory have been set, then we'll render the draft
    useEffect(() => {
        if (draftPool.length > 0 && draftHistory.length > 0) {
            setLoading(false)
        }
    }, [draftPool, draftHistory]);
    
    //Finally we need to trim the draft pool?  This is gonna need a think.
    useEffect(() => {
    //remove drafted players from draft pool
    let pool = [...availablePlayers]
    let picks = draftHistory.filter(p => p.Player != null)
    picks.forEach(p => {
        let index = pool.findIndex(player => player === p.Player)
        pool.splice(index, 1)
    })
    setAvailablePlayers(pool)
        
    }, [loading]);
    

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
                        //In this version, we need to update history and availablePlayers
                        let avail = availablePlayers.filter(p => p !== data.Player)
                        let history = [...draftHistory]
                        let slot = history.find(p => p.Slot === data.Pick)
                        slot.Player = data.Player
                        setAvailablePlayers(avail)
                        setDraftHistory(history)
                        shiftFocus({context: "default"})
                        setCurrentPick(currentPick + 1)
                        Notify(props.teams.find(t => t.ID === data.Team).Name + " has selected " + draftPool.find(p => p.ID === data.Player).Name, 1)
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
    }, [draftSocket, draftHistory, availablePlayers, userStatus, currentPick])

        //To start, we want to fetch our draft history and draft class.  While these could be gathered from
    //our initial websocket connection or as a single request, I can see a scenario where we want to have 
    //a draft class preview before a draft, as well as an accessible draft history after the draft.     

    function fetchDraftHistory() {
        fetch("/league/draft/" + props.league.ID, { method: "GET" })
        .then(response => response.json())
        .then(data => {
            let history = data.map(p => p)
            setCurrentPick(history.length)
            //We'll pass an empty or incomplete list of picks.  We want to then expand the array
            //to hold all potential picks in the future.
            if (history.length != ROUNDS*props.teams.length) {
                let snakeFirst = [...props.teams].sort((a,b) => a.Slot - b.Slot)
                let snakeSecond = [...props.teams].sort((a,b) => b.Slot - a.Slot)
                let draftLength = ROUNDS*props.teams.length
                for (let i = history.length; i < draftLength; i++) {
                    let roundPick = i % props.teams.length
                    if (Math.floor(i/props.teams.length) % 2 === 0) {
                        history.push({Player: null, Slot: i, Team: snakeFirst[roundPick].ID})
                    } else {
                        history.push({Player: null, Slot: i, Team: snakeSecond[roundPick].ID})
                    } 
                }
            }
            setDraftHistory(history)
        })
        .catch(error => console.error(error))
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
            let availPlayers = draftClass.map(p => p.ID)
            setStatHeaders(headers)
            setAvailablePlayers(availPlayers)
            setDraftPool(draftClass)
        })
        .catch(error => Notify(error, 0))
    }

    function submitChat(e) {
        e.preventDefault()
        draftSocket.current.send(JSON.stringify({"Kind":"message", "Payload": msg.value}))
    }

    function submitPick(playerID) {
        let team = props.teams.find(t => t.Manager.ID === User.ID)
        draftSocket.current.send(JSON.stringify({"Kind":"pick", "Payload":{"Player": playerID, "Pick":currentPick, "Team":team.ID, "League": props.league.ID}}))
    }

    function shiftFocus(focusable) {
        switch (focusable.context) {
            case "player":
                setBoardFocus({context:"player", data:focusable.focusable})
                break;
            case "team":
                setBoardFocus({context:"team", data:focusable.focusable})
                break;
            default:
                setBoardFocus({context:"summary", data: null})
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
        <DraftBoard 
        focus={boardFocus}
        history={draftHistory}
        players={draftPool}
        shiftFocus={shiftFocus}
        selectPlayer={submitPick}
        currentPick={currentPick}
        teams={props.teams}
        />
        <DraftPool 
        players={draftPool} 
        available={availablePlayers}
        headers={statHeaders} 
        tableSort={sortDraftPool} 
        shiftFocus={shiftFocus} />
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
        let chosen = props.players.find(player => player.ID == e.target.parentElement.id)
        props.shiftFocus({context: 'player', focusable: chosen})
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
            {props.players.filter(p => props.available.includes(p.ID)).map((player) => 
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

//Draft board is going to be the general information box.  On entry, players will see a default that shows the draft order and as the draft progresses, the
//draft board home screen will track the most recent round of picks.  Possibly with some sort of table showing best available players or something in that vein.
//The draft board will also have different views based on context.  Selected players will bring up their name, pertinent stats and a draft button. 
//Selected teams will show their roster so far.  Both views will have a back button to restore the base draft board.
function DraftBoard(props) {
    const User = useContext(UserContext)

    if (props.currentPick >= ROUNDS * props.teams.length) {
        //Draft over, display teams.
        let teamSummaries = []
        for (let i = 0; i < props.teams.length; i++) {
            let picks = props.history.filter(p => p.Team === props.teams[i].ID)
            let roster = picks.map(pick => props.players.find(p => p.ID === pick.Player))
            teamSummaries.push(<TeamSummary 
                                team={props.teams[i]} 
                                roster={roster} 
                                currentPick={props.currentPick} 
                                max={ROUNDS*props.teams.length}/>)
        }
        return teamSummaries
    } else {
        let drafting = props.history[props.currentPick] 
        if (props.focus.context === 'player') {
            return <PBio player={props.focus.data} 
                selectPlayer={props.selectPlayer} 
                drafting={drafting.Team}
                teamControl={props.teams.find(t => t.Manager.ID === User.ID)}  
                shiftFocus={props.shiftFocus}/>
        }
        if (props.focus.context === 'team') {
            let picks = props.history.filter(pick => pick.Team === props.focus.data.ID).filter(p => p.Player != null)
            let roster = picks.map(pick => props.players.find(p => p.ID === pick.Player))
            let team = props.teams.find(team => team.ID === drafting.Team)
            return <TeamSummary 
                    team={team} 
                    roster={roster} 
                    shiftFocus={props.shiftFocus} 
                    currentPick={props.currentPick} 
                    max={ROUNDS*props.teams.length}/>
        }
        
        return <DraftSummary 
                history={props.history} 
                currentPick={props.currentPick} 
                teams={props.teams} 
                shiftFocus={props.shiftFocus}
                players={props.players}/>
        
    }
}

//Draft summary is an overview of the draft.
function DraftSummary(props) {
    //Make it navigable.
    const [page, setPage] = useState(0)
    const [summary, setSummary] = useState([])

    //For spacing, we're going with 10 table heights for all draft board views, so we'll display labels, 8 picks, then navigation for Draft Summary
    const pageLength = 8
    const pageMax = Math.floor((ROUNDS*props.teams.length-1)/pageLength)

    //Set page on load
    useEffect(()=>{
        setPage(Math.floor(props.currentPick/pageLength))
    }, [])

    //Change summary on page change
    useEffect(()=>{
        let end = page*pageLength+8 >= ROUNDS*props.teams.length ? ROUNDS*props.teams.length : page*pageLength+8
        setSummary(props.history.slice(page*pageLength, end))
    }, [page, props])

    const navigate = (e) => {
        e.preventDefault()
        e.target.id === 'previous' ? setPage(page-1) : setPage(page+1) 
    }

    const teamFocus = (e) => {
        e.preventDefault()
        let chosen = props.teams.find(t => t.ID == e.currentTarget.attributes.team.value)
        props.shiftFocus({context: 'team', focusable: chosen})
    }

    return(
            <table className='table table-responsive table-sm text-center'>
                <thead>
                <tr>
                    <th>Team</th><th>Pick</th><th>Selection</th>
                </tr>
                </thead>
                <tbody>
                    {summary.map((row) =>
                        //TODO: Styling for active pick
                        <tr key={'draft_row_' + row.Slot}>
                            <td><div className='d-grid gap-2 text-nowrap overflow-hidden'>
                                <button 
                                className='btn btn-outline-success btn-sm' 
                                team={row.Team} 
                                onClick={teamFocus}>{props.teams.find(team => row.Team === team.ID).Name}</button>
                            </div></td>
                            <td>Pick: {row.Slot + 1}</td>
                            <td>{row.Player === null ? 'tbd' : props.players.find(player => player.ID === row.Player).Name}</td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td className='col-5'>
                        <div className='d-grid gap-2'>
                        {page === 0 ?
                        <button className='btn btn-warning btn-sm' id='previous' onClick={navigate} disabled>Previous</button> :
                        <button className='btn btn-warning btn-sm' id='previous' onClick={navigate}>Previous</button>}
                        </div>
                        </td>
                        <td className='col-2'>
                        <div className='text-center'>
                        {page + 1} of {pageMax + 1}
                        </div>
                        </td>
                        <td className='col-5'>
                        <div className='d-grid gap-2'>
                        {page === pageMax ?
                        <button id='next' className='btn btn-warning btn-sm' onClick={navigate} disabled>Next</button> :
                        <button className='btn btn-warning btn-sm' id='next' onClick={navigate}>Next</button>}
                        </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
    )
}

function PBio(props) {

    const resetFocus = (e) => {
        e.preventDefault()
        props.shiftFocus({context: 'summary', focusable: null})
    }

    const handleSelection = (e) => {
        e.preventDefault()
        let playerID = Number.parseInt(e.target.id, 10)
        props.selectPlayer(playerID)
    }

    const QB = [
        'PassYards',
        'PassInterceptions',
        'PassTouchdowns',
        'FantasyPoints',
        'ValueBased'
    ]
    const RB = [
        'RushYards',
        //'rushing_yards_per_attempt_YPA',
        'RushTouchdowns',
        'FantasyPoints',
        'ValueBased'
    ]
    const WR = [
        'Receptions',
        'ReceivingYards',
        'ReceivingTouchdowns',
        'FantasyPoints',
        'ValueBased'
    ]

    let url = 'https://www.pro-football-reference.com/players/' + props.player.PfbrName[0] + '/' + props.player.PfbrName + '.htm'
    let displayStats = []
    if (props.player.Position === "RB") {
        displayStats.push({key: "YPC", value: Math.ceil((props.player.RushYards/props.player.RushAttempts)*100) / 100})
    }
    Object.entries(props.player).forEach(([key, value]) => {
        switch (props.player.Position) {
            case 'QB':
                if (QB.includes(key)) {
                    // Object.defineProperty(displayStats, key, {
                    //     value: value
                    // })
                    displayStats.push({key: key, value: value})
                }
                break
            case 'RB':
                if (RB.includes(key)) {
                    // Object.defineProperty(displayStats, key, {
                    //     value: value
                    // })
                    displayStats.push({key: key, value: value})
                }
                break
            default:
                if (WR.includes(key)) {
                    // Object.defineProperty(displayStats, key, {
                    //     value: value
                    // })
                    displayStats.push({key: key, value: value})
                }
                break
        }
    })
    

    return(
        <div>
            <table className='table table-responsive table-sm'>
                <thead>
                    <tr>
                        <td colSpan='4'>
                            <div className='d-grid gap-2'>
                                <button onClick={resetFocus} className='btn btn-danger btn-sm'>Draft Summary</button>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <th colSpan='2'>{props.player.Name}</th>
                        <th>Age</th>
                        <th>Team</th>
                        
                    </tr>
                    <tr>
                        <td colSpan='2'>{props.player.Position}</td>
                        <td>{props.player.Age}</td>
                        <td>{props.player.Team}</td>
                    </tr>
                </thead>
                <tbody className='text-center'>{ displayStats.map(s =>  
                        <tr key={s.key + "_bio"}>
                            <th>{s.key}</th><td>{s.value}</td><td colSpan='2'></td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan='4'><a href={url}>See their whole career at Pro-Football-Reference.com</a></td>
                    </tr>
                    <tr>
                        <td colSpan='4'>
                        <div className='d-grid gap-2'>
                        {props.teamControl.ID === props.drafting ? 
                        <button className='btn btn-success btn-sm' id={props.player.ID} onClick={handleSelection}>Draft</button> : 
                        <button className='btn btn-light btn-sm' id={props.player.ID} onClick={handleSelection} disabled>Draft</button>}
                        </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}


//Team Summary is a view that shows a teams selected players, as well as point totals for each position.
function TeamSummary(props) {
    const resetFocus = (e) => {
        e.preventDefault()
        props.shiftFocus({context: 'summary', focusable: null})
    }

    let qbs = []
    let rbs = []
    let wrs = []
    let tes = []
    
    let qbPoints = 0
    let rbPoints = 0
    let wrPoints = 0
    let tePoints = 0
    
    for (let i = 0; i < props.roster.length; i++) {
        if (props.roster[i] !== 'tbd') {
            switch (props.roster[i].Position) {
                case 'QB': 
                    qbs.push(props.roster[i])
                    qbPoints += props.roster[i].FantasyPoints
                    break
                case 'RB': 
                    rbs.push(props.roster[i])
                    rbPoints += props.roster[i].FantasyPoints
                    break
                case 'WR': 
                    wrs.push(props.roster[i])
                    wrPoints += props.roster[i].FantasyPoints
                    break
                case 'TE': 
                    tes.push(props.roster[i])
                    tePoints += props.roster[i].FantasyPoints
                    break
            }
        }
    }
    
    // let max = Math.max(qbs.length, rbs.length, wrs.length, tes.length)

        return(
            <table className='table table-responsive table-sm text-center'>
                <thead>
                {props.currentPick < props.max ?
                <tr><td colSpan='5'><div className='d-grid gap-2'>
                    <button onClick={resetFocus} className='btn btn-danger btn-sm'>Draft Summary</button>
                </div></td></tr>
                : ''
                }
                <tr><th colSpan='5'>{props.team.Name}</th></tr>
                <tr><td colSpan='5'>Manager: {props.team.Manager.name}</td></tr>
                <tr>
                    <td></td><th>QB</th><th>RB</th><th>WR</th><th>TE</th>
                </tr>
                </thead>
                <tbody>
                {/* For spacing, we'll list the first 5 players taken at each position.  is sufficient for show, though future iterations
                we'll need a more robust solution */}
                {[...Array(5)].map((_,i) => 
                    <tr key={'roster_row' + (i + 1).toString()}>
                        <th>{i + 1}:</th>
                        <td key={'QB' + (i + 1).toString()}>{i < qbs.length ? qbs[i].Name : ''}</td>
                        <td key={'RB' + (i + 1).toString()}>{i < rbs.length ? rbs[i].Name : ''}</td>
                        <td key={'WR' + (i + 1).toString()}>{i < wrs.length ? wrs[i].Name : ''}</td>
                        <td key={'TE' + (i + 1).toString()}>{i < tes.length ? tes[i].Name : ''}</td>
                    </tr>
                )}
                </tbody>
                <tfoot>
                    <tr>
                        <td></td><td>QB Pts: {qbPoints}</td><td> RB pts: {rbPoints}</td><td> WR pts: {wrPoints}</td><td>TE Points: {tePoints}</td>
                    </tr>
                </tfoot>
            </table>
        )
}

export default Draft