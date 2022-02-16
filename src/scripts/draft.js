'use strict'
import React, { useState, useEffect, useRef, useContext } from 'react'
import { UserContext, NotifyContext, ALPHA } from './util.js'

const BS_SUCCESS = '#198754aa'
const BS_WARNING = '#ffc107aa'
const BS_PRIMARY = '#0d6efdaa'
const BS_SECONDARY = '#6c757daa'

// History = [{Slot: int, Player: ID, Team: ID}]

function Draft (props) {
  const [draftPool, setDraftPool] = useState([])
  const [availablePlayers, setAvailablePlayers] = useState([])
  const [draftHistory, setDraftHistory] = useState([])
  const [statHeaders, setStatHeaders] = useState([])
  const [boardFocus, setBoardFocus] = useState({ context: 'summary' })
  const [lastSort, setLastSort] = useState('')
  const [currentPick, setCurrentPick] = useState(0)
  const [userStatus, setUserStatus] = useState([])
  const [loading, setLoading] = useState(true)
  const [chat, setChat] = useState([])
  const [smacks, setSmacks] = useState([])
  const [lastMessage, setLastMessage] = useState('')
  const draftSocket = useRef(null)
  const User = useContext(UserContext)
  const Notify = useContext(NotifyContext)

  useEffect(() => {
    fetchDraftHistory()
    fetchDraftPool()
    // So we're going to use a websocket to update the draft as it progresses.
    draftSocket.current = new WebSocket(
      'ws://' +
            window.location.host +
            '/ws/draft/' +
            props.league.ID
    )
    const initSmack = props.teams.map(t => { return { team: t.ID, smack: '' } })
    setSmacks(initSmack)
  }, [])
  // we wait for draftPool and DraftHistory to be filled, then load the page
  useEffect(() => {
    if (draftPool.length > 0 && draftHistory.length > 0 && userStatus !== []) {
      setLoading(false)
    }
  }, [draftPool, draftHistory, userStatus])

  // Finally, since I was getting funky results doing this in the above useEffect, we'll wait for loading
  // to get updated, which by then we should be reasonably sure that draftPool and DraftHistory have actually
  // been set in state.
  useEffect(() => {
    // remove drafted players from draft pool
    const pool = [...availablePlayers]
    const picks = draftHistory.filter(p => p.Player != null)
    picks.forEach(p => {
      const index = pool.findIndex(player => player === p.Player)
      pool.splice(index, 1)
    })
    setAvailablePlayers(pool)
  }, [loading])

  // This useEffect sets control for our draft socket.  We want it to update not only when the 'draftsocket'
  // transitions from null, but we want to update this anytime we have a state change on any states we access
  // within this controller.
  useEffect(() => {
    if (draftSocket !== null) {
      draftSocket.current.onclose = (e) => {
        console.log('Websocket closed unexpectedly')
      }
      draftSocket.current.onopen = (e) => {
        // When we join, all users in the room receive a status message, while the joiner gets
        // a user list.  So we probably don't need this...
      }
      draftSocket.current.onmessage = (e) => {
        const data = JSON.parse(e.data)
        switch (data.Kind) {
          // "users" is only sent upon joining a room.  it passes a list of user ids that are
          // currently in a draft instance
          case 'users': {
            // create a temp status, with all teams managers ids and an active false
            const tempStatus = props.teams.map(team => { return { ID: team.Manager.ID, active: false } })
            tempStatus.forEach(user => {
              if (data.Users.includes(user.ID)) {
                user.active = true
              }
            })
            setUserStatus(tempStatus)
            break
          }
          case 'status':
          {
            const tempStatus = [...userStatus]
            tempStatus.forEach(user => {
              if (user.ID === data.User) {
                user.active = data.Active
              }
            })
            setUserStatus(tempStatus)
            break
          }
          case 'draft': {
            // In this version, we need to update history and availablePlayers
            const avail = availablePlayers.filter(p => p !== data.Player)
            const history = [...draftHistory]
            const slot = history.find(p => p.Slot === data.Pick)
            slot.Player = data.Player
            setAvailablePlayers(avail)
            setDraftHistory(history)
            shiftFocus({ context: 'default' })
            setCurrentPick(currentPick + 1)
            Notify(props.teams.find(t => t.ID === data.Team).Name + ' has selected ' + draftPool.find(p => p.ID === data.Player).Name, 1)
            break }
          case 'chat': {
            const chatClone = [...chat]
            const team = props.teams.find(t => t.Manager.ID === data.User)
            chatClone.push({ team: team, message: data.Payload })
            setChat(chatClone)
            break }
          default: {
            console.log('sent ' + data.Kind + ' message type, why did you do that?')
            break }
        }
      }
    }
  }, [draftSocket, draftHistory, availablePlayers, userStatus, currentPick, chat])

  // To start, we want to fetch our draft history and draft class.  While these could be gathered from
  // our initial websocket connection or as a single request, I can see a scenario where we want to have
  // a draft class preview before a draft, as well as an accessible draft history after the draft.

  function fetchDraftHistory () {
    const fetchData = async () => {
      const response = await fetch('/league/draft/' + props.league.ID, { method: 'GET' })
      const data = await response.json()

      if (response.ok) {
        const history = data.map(p => p)
        setCurrentPick(history.length)
        // We'll pass an empty or incomplete list of picks.  We want to then expand the array
        // to hold all potential picks in the future.
        if (history.length !== props.settings.draft.Rounds * props.teams.length) {
          const snakeFirst = [...props.teams].sort((a, b) => a.Slot - b.Slot)
          const snakeSecond = [...props.teams].sort((a, b) => b.Slot - a.Slot)
          const draftLength = props.settings.draft.Rounds * props.teams.length
          for (let i = history.length; i < draftLength; i++) {
            const roundPick = i % props.teams.length
            if (Math.floor(i / props.teams.length) % 2 === 0) {
              history.push({ Player: null, Slot: i, Team: snakeFirst[roundPick].ID })
            } else {
              history.push({ Player: null, Slot: i, Team: snakeSecond[roundPick].ID })
            }
          }
        }
        setDraftHistory(history)
      } else {
        Notify('Failed to fetch history', 0)
      }
    }
    fetchData()
      .catch(error => console.error(error))
  }

  // Again, there's probably a way we can derive this from the database and use our string mangler in
  // FetchDraftPool to display these, but for now this is expedient.
  const abbreviations = {
    ID: 'ID',
    Name: 'Name',
    PfbrName: 'PN',
    Team: 'Team',
    Position: 'Pos',
    Age: 'Age',
    Games: 'GP',
    Starts: 'GS',
    PassCompletions: 'Comp',
    PassAttempts: 'Att',
    PassYards: 'Yd',
    PassTouchdowns: 'Td',
    PassInterceptions: 'Int',
    RushAttempts: 'Att',
    RushYards: 'Yd',
    RushTouchdowns: 'Td',
    Targets: 'Tar',
    Receptions: 'Rec',
    ReceivingYards: 'Yd',
    ReceivingTouchdowns: 'Td',
    Fumbles: 'Fmb',
    FumblesLost: 'FmbL',
    AllTouchdowns: 'Td',
    TwoPointConversion: 'Tpc',
    TwoPointPass: 'Tpp',
    FantasyPoints: 'Fp',
    PointPerReception: 'Ppr',
    ValueBased: 'Vbd'
  }

  function fetchDraftPool () {
    const fetchData = async () => {
      const response = await fetch('/draftpool', { method: 'GET' })
      const data = await response.json()

      if (response.ok) {
        const draftClass = []
        const headers = []
        for (let i = 0; i < data.Players.length; i++) {
          draftClass.push(data.Players[i])
          if (i === 0) {
            const rawHeaders = Object.keys(data.Players[i])
            for (let j = 0; j < rawHeaders.length; j++) {
              // We store our headers as their verbose names, but it would be useful to carry an
              // abbreviation along with the full name.  Our database structure is a little different
              // from our python implementation (mostly trying to find a sweet spot on how verbose to
              // be in the database + the different rules for marshalling objects into json).
              let verbose = ''
              const indices = []
              for (let k = 0; k < rawHeaders[j].length; k++) {
                // Not a huge fan of this, but it will work for english.
                if (rawHeaders[j].charAt(k) === rawHeaders[j].charAt(k).toUpperCase()) {
                  indices.push(k)
                }
              }

              if (indices.length === rawHeaders[j].length) {
                // ID is an example, though we won't expose that to users.
                verbose = rawHeaders[j]
              } else {
                // split on our capital letter indices, adding a space before them to make our verbose strings
                // more readable.
                for (let k = 0; k < indices.length; k++) {
                  if (k + 1 < indices.length) {
                    verbose = verbose.concat(rawHeaders[j].slice(indices[k], indices[k + 1]), ' ')
                  } else {
                    // slice k to end
                    verbose = verbose.concat(rawHeaders[j].slice(indices[k]))
                  }
                }
              }
              headers.push({ verbose: verbose, abbreviation: abbreviations[rawHeaders[j]], raw: rawHeaders[j] })
            }
          }
        }
        const availPlayers = draftClass.map(p => p.ID)
        setStatHeaders(headers)
        setAvailablePlayers(availPlayers)
        setDraftPool(draftClass)
      } else {
        Notify('Failed to fetch players', 0)
      }
    }
    fetchData()
      .catch(error => console.error(error))
  }

  // -- Chat Stuff --
  // we would refactor into it's own thing but we're spending a lot of time on it as it is.
  function submitChat (message) {
    draftSocket.current.send(JSON.stringify({ Kind: 'message', Payload: message }))
  }

  function progressChat () {
    const tempChat = [...chat]
    const msg = tempChat.shift()
    // do something with msg like take the user ID, find the team, and update the value in the team order quotes.
    setLastMessage(msg)
  }

  // Because of the vagueries of using something like a useEffect to trigger an animation and await its conclusion, we
  // need to check when we update 'smacks'
  useEffect(() => {
    if (lastMessage !== '') {
      // handle message
      const tempChat = [...chat]
      const tempSmacks = [...smacks]
      tempChat.shift()
      const newSmack = tempSmacks.find(s => s.team === lastMessage.team.ID)
      newSmack.smack = lastMessage.message
      setSmacks(tempSmacks)
      setChat(tempChat)
      setLastMessage('')
    }
  }, [lastMessage, smacks, chat])

  function submitPick (playerID) {
    const team = props.teams.find(t => t.Manager.ID === User.ID)
    draftSocket.current.send(JSON.stringify({ Kind: 'pick', Payload: { Player: playerID, Pick: currentPick, Team: team.ID, League: props.league.ID } }))
  }

  function shiftFocus (focusable) {
    switch (focusable.context) {
      case 'player':
        setBoardFocus({ context: 'player', data: focusable.focusable })
        break
      case 'team':
        setBoardFocus({ context: 'team', data: focusable.focusable })
        break
      default:
        setBoardFocus({ context: 'summary', data: null })
        break
    }
  }

  function sortDraftPool (header) {
    const sortedPool = [...draftPool]
    for (const [key, value] of Object.entries(draftPool[0])) {
      if (key === header) {
        const chars = String(value).toLowerCase().split('')
        if (ALPHA.includes(chars[0])) {
          // Alpha sort
          if (lastSort !== header) {
            sortedPool.sort((a, b) => a[key].toString().localeCompare(b[key].toString()))
            setLastSort(header)
          } else {
            sortedPool.sort((a, b) => b[key].toString().localeCompare(a[key].toString()))
            setLastSort('')
          }
          setDraftPool(sortedPool)
        } else {
          // Number sort
          if (lastSort !== header) {
            sortedPool.sort((a, b) => b[key] - a[key])
            setLastSort(header)
          } else {
            sortedPool.sort((a, b) => a[key] - b[key])
            setLastSort('')
          }
          setDraftPool(sortedPool)
        }
        break
      }
    }
  }

  if (loading) {
    return (<div>loading...</div>)
  }

  return (
        <div className='text-center'>
          <h1 className='display-4'>{props.league.name} Draft</h1>
          <div className='row m-2 g-1'>
            <div className='col-8'>
              <DraftBoard
                focus={boardFocus}
                history={draftHistory}
                players={draftPool}
                shiftFocus={shiftFocus}
                selectPlayer={submitPick}
                currentPick={currentPick}
                teams={props.teams}
                rounds={props.settings.draft.Rounds}/>
            </div>
            <div className='col-4' style={{ maxHeight: '30em', overflowY: 'scroll' }}>
              <DraftOrder currentPick={currentPick}
                teams={props.teams}
                userStatus={userStatus}
                history={draftHistory}
                shiftFocus={shiftFocus}
                smacks={smacks}
                rounds={props.settings.draft.Rounds}/>
            </div>
          </div>
          <DraftPool
            players={draftPool}
            available={availablePlayers}
            headers={statHeaders}
            tableSort={sortDraftPool}
            shiftFocus={shiftFocus} />
          <DraftChat
            chat={submitChat}
            messages={chat}
            setChat={setChat}
            progress={progressChat}
            />
        </div>
  )
}

function DraftPool (props) {
  const passing = [
    'PassCompletions',
    'PassAttempts',
    'PassYards',
    'PassInterceptions'
  ]
  const rushing = [
    'RushAttempts',
    'RushYards'
    // 'rushing_yards_per_attempt_YPA',  -I guess I excised this
  ]
  const receiving = [
    'Targets',
    'Receptions',
    'ReceivingYards'
    // 'receiving_yards_per_catch_YPC', -Another casualty
  ]
  const miscScoring = [
    'TwoPointConversion',
    'TwoPointPass'
  ]
  const fantasy = [
    'PointPerReception'
    // 'fantasy_DK_DK',
    // 'fantasy_FD_FD', - gone but not forgotten
  ]
  const general = [
    'Age',
    'Team',
    'Games',
    'Starts'
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
  const [sorted, setSorted] = useState('ValueBased')

  const HandleSort = (e) => {
    e.preventDefault()
    setSorted(e.currentTarget.id)
    props.tableSort(e.currentTarget.id)
  }

  const HandleFocus = (e) => {
    e.preventDefault()
    const chosen = props.players.find(player => player.ID === parseInt(e.target.parentElement.id))
    props.shiftFocus({ context: 'player', focusable: chosen })
  }

  // list comprehensions would be nice here, but this resolves alright.
  const expandStats = (e) => {
    switch (e.target.id) {
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
        miscScoring.every(category => expandables.includes(category))
          ? setExpandables([...expandables].filter((category) => !miscScoring.includes(category)))
          : setExpandables([...expandables].concat(miscScoring))
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

  return (
        <div className='table-responsive overflow-auto'>
        <table className='table table-bordered border-success table-hover table-sm text-center'>
            <caption>Draft Pool</caption>
            <colgroup>
              {props.headers.map(h => {
                if (expandables.includes(h.raw)) {
                  return h.raw !== sorted ? <col key={h.raw}/> : <col key={h.raw} className='bg-warning'/>
                }
                return null
              })}
            </colgroup>
            <thead>
                <tr className='bg-warning'>
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
                      // We need to split our headers on the underscores.  If the can be split, then the final
                      // string will be its abbreviation, while the rest of the strings are the full name.
                      if (header.verbose === 'Pfbr Name') {
                        // Do Nothing
                        return null
                      } else {
                        if (expandables.includes(header.raw)) {
                          return <th key={header.raw + '_key'} scope='col'>
                            <div className='d-grid gap-2'>
                              <button className="btn btn-warning btn-sm" id={header.raw} onClick={HandleSort}>{header.abbreviation}</button>
                            </div>
                            </th>
                        } else {
                          return null
                        }
                      }
                    })}
                </tr>
            </thead>
            <tbody>
            {props.players.filter(p => props.available.includes(p.ID)).map((player) =>
                <tr key={player.PfbrName} onClick={HandleFocus} id={player.ID}>
                    {Object.values(player).map((stat, index) => {
                      // We should have a key for this value, probably a confab of code_name and the stat header.  But since we're
                      // Not going to update scores in this version we'll leave be for the moment.
                      const code = Object.keys(player)
                      const nameCode = Object.values(player)
                      if (expandables.includes(code[index])) {
                        return index === 0
                          ? <th scope='row' key={code[index] + ' ' + nameCode[1]} >{stat}</th>
                          : <td key={code[index] + ' ' + nameCode[1]}>{stat}</td>
                      } else {
                        return null
                      }
                    })}
                </tr>
            )}
            </tbody>
        </table>
        </div>
  )
}

// Draft board is going to be the general information box.  On entry, players will see a default that shows the draft order and as the draft progresses, the
// draft board home screen will track the most recent round of picks.  Possibly with some sort of table showing best available players or something in that vein.
// The draft board will also have different views based on context.  Selected players will bring up their name, pertinent stats and a draft button.
// Selected teams will show their roster so far.  Both views will have a back button to restore the base draft board.
function DraftBoard (props) {
  const User = useContext(UserContext)

  if (props.currentPick >= props.rounds * props.teams.length) {
    // Draft over, display teams.
    const teamSummaries = []
    for (let i = 0; i < props.teams.length; i++) {
      const picks = props.history.filter(p => p.Team === props.teams[i].ID)
      const roster = picks.map(pick => props.players.find(p => p.ID === pick.Player))
      teamSummaries.push(<TeamSummary
                          team={props.teams[i]}
                          roster={roster}
                          currentPick={props.currentPick}
                          max={props.rounds * props.teams.length}/>)
    }
    return teamSummaries
  } else {
    const drafting = props.history[props.currentPick]
    if (props.focus.context === 'player') {
      return <PBio player={props.focus.data}
              selectPlayer={props.selectPlayer}
              drafting={drafting.Team}
              teamControl={props.teams.find(t => t.Manager.ID === User.ID)}
              shiftFocus={props.shiftFocus}/>
    }
    if (props.focus.context === 'team') {
      const picks = props.history.filter(pick => pick.Team === props.focus.data.ID).filter(p => p.Player != null)
      const roster = picks.map(pick => props.players.find(p => p.ID === pick.Player))
      return <TeamSummary
              team={props.focus.data}
              roster={roster}
              shiftFocus={props.shiftFocus}
              currentPick={props.currentPick}
              max={props.rounds * props.teams.length}/>
    }

    return <DraftSummary
            history={props.history}
            currentPick={props.currentPick}
            teams={props.teams}
            shiftFocus={props.shiftFocus}
            players={props.players}
            rounds={props.rounds}/>
  }
}

// Draft summary is an overview of the draft.
function DraftSummary (props) {
  // Make it navigable.
  const [page, setPage] = useState(0)
  const [summary, setSummary] = useState([])

  // For spacing, we're going with 10 table heights for all draft board views, so we'll display labels, 8 picks, then navigation for Draft Summary
  const pageLength = 10
  const pageMax = Math.floor((props.rounds * props.teams.length - 1) / pageLength)

  // Set page on load
  useEffect(() => {
    setPage(Math.floor(props.currentPick / pageLength))
  }, [])

  // Change summary on page change
  useEffect(() => {
    const end = page * pageLength + pageLength >= props.rounds * props.teams.length ? props.rounds * props.teams.length : page * pageLength + pageLength
    setSummary(props.history.slice(page * pageLength, end))
  }, [page, props])

  const navigate = (e) => {
    e.preventDefault()
    e.target.id === 'previous' ? setPage(page - 1) : setPage(page + 1)
  }

  const teamFocus = (e) => {
    e.preventDefault()
    const chosen = props.teams.find(t => t.ID === parseInt(e.currentTarget.attributes.team.value))
    props.shiftFocus({ context: 'team', focusable: chosen })
  }

  return (
            <table className='table table-responsive table-sm text-center'>
                <thead>
                <tr>
                    <th>Team</th><th>Pick</th><th>Selection</th>
                </tr>
                </thead>
                <tbody>
                    {summary.map((row) =>
                        // TODO: Styling for active pick
                        <tr key={'draft_row_' + row.Slot}>
                            <td><div className='d-grid gap-2 text-nowrap overflow-hidden'>
                                <button
                                className='btn btn-outline-success btn-sm'
                                team={row.Team}
                                onClick={teamFocus}>{props.teams.find(team => row.Team === team.ID).Name}</button>
                            </div></td>
                            <td>R:{Math.floor(row.Slot / props.teams.length) + 1} P:{(row.Slot % props.teams.length) + 1}</td>
                            <td>{row.Player === null ? 'tbd' : props.players.find(player => player.ID === row.Player).Name}</td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td className='col-5'>
                        <div className='d-grid gap-2'>
                        {page === 0
                          ? <button className='btn btn-warning btn-sm' id='previous' onClick={navigate} disabled>Previous</button>
                          : <button className='btn btn-warning btn-sm' id='previous' onClick={navigate}>Previous</button>}
                        </div>
                        </td>
                        <td className='col-2'>
                        <div className='text-center'>
                        {page + 1} of {pageMax + 1}
                        </div>
                        </td>
                        <td className='col-5'>
                        <div className='d-grid gap-2'>
                        {page === pageMax
                          ? <button id='next' className='btn btn-warning btn-sm' onClick={navigate} disabled>Next</button>
                          : <button className='btn btn-warning btn-sm' id='next' onClick={navigate}>Next</button>}
                        </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
  )
}

function PBio (props) {
  const resetFocus = (e) => {
    e.preventDefault()
    props.shiftFocus({ context: 'summary', focusable: null })
  }

  const handleSelection = (e) => {
    e.preventDefault()
    const playerID = parseInt(e.target.id, 10)
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
    // 'rushing_yards_per_attempt_YPA',
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

  const url = 'https://www.pro-football-reference.com/players/' + props.player.PfbrName[0] + '/' + props.player.PfbrName + '.htm'
  const displayStats = []
  if (props.player.Position === 'RB') {
    displayStats.push({ key: 'YPC', value: Math.ceil((props.player.RushYards / props.player.RushAttempts) * 100) / 100 })
  }
  Object.entries(props.player).forEach(([key, value]) => {
    switch (props.player.Position) {
      case 'QB':
        if (QB.includes(key)) {
          displayStats.push({ key: key, value: value })
        }
        break
      case 'RB':
        if (RB.includes(key)) {
          displayStats.push({ key: key, value: value })
        }
        break
      default:
        if (WR.includes(key)) {
          displayStats.push({ key: key, value: value })
        }
        break
    }
  })

  return (
        <div>
            <table className='table table-responsive table'>
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
                        <tr key={s.key + '_bio'}>
                            <th colSpan={2}>{s.key}</th><td colSpan={2}>{s.value}</td>
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
                        {props.teamControl.ID === props.drafting
                          ? <button className='btn btn-success btn-lg' id={props.player.ID} onClick={handleSelection}>Draft</button>
                          : <button className='btn btn-light btn-lg' id={props.player.ID} onClick={handleSelection} disabled>Draft</button>}
                        </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
  )
}

// Team Summary is a view that shows a teams selected players, as well as point totals for each position.
function TeamSummary (props) {
  const resetFocus = (e) => {
    e.preventDefault()
    props.shiftFocus({ context: 'summary', focusable: null })
  }

  const qbs = []
  const rbs = []
  const wrs = []
  const tes = []

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

  return (
    <table className='table table-responsive table text-center'>
      <thead>
      {props.currentPick < props.max
        ? <tr>
            <td colSpan='5'>
              <div className='d-grid gap-2'>
                <button onClick={resetFocus} className='btn btn-danger btn-sm'>Draft Summary</button>
              </div>
            </td>
          </tr>
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
      {[...Array(5)].map((_, i) =>
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

// What we want here is a bar across the bottom which both indicates who is in the draft as well as who is on the clock to make
// a pick.  Since discourse in a fantasy draft sin't necessarily conducive to drawn out conversations, I think we should hijack
// Draft order to hold our chat as well.  Instead of an text area, we'll give each team a little conversation balloon within the
// draft order component that will display their latest X messages.
function DraftOrder (props) {
  function HandleFocus (e) {
    e.preventDefault()
    const chosen = props.teams.find(t => t.ID === parseInt(e.currentTarget.attributes.team.value))
    props.shiftFocus({ context: 'team', focusable: chosen })
  }

  const draftMax = props.teams.length * props.rounds
  const draftData = []

  if (props.userStatus === []) {
    return null
  }
  if (props.history.length === 0) {
    return null
  }

  if (props.currentPick >= draftMax) {
    return null
  }
  for (let i = props.currentPick; i < props.currentPick + (props.teams.length * 2); i++) {
    const round = Math.floor(i / props.teams.length) + 1
    const pick = (i % props.teams.length) + 1
    let highlight = ''
    const team = props.teams.find(t => t.ID === props.history[i].Team)
    const user = props.userStatus.find(u => u.ID === team.Manager.ID)
    if (i < draftMax) {
      if (i === props.currentPick) {
        highlight = BS_SUCCESS
        if (!user.active) {
          highlight = BS_WARNING
        }
      } else {
        highlight = BS_PRIMARY
        if (!user.active) {
          highlight = BS_SECONDARY
        }
      }
    }
    if (i < draftMax) {
      draftData.push({ pick: pick, round: round, team: team, highlight: highlight })
    }
  }

  return (
        <div className='text-center bg-warning rounded-3 m-2 p-2'>
          <div className='row'>
            <div className='col'>
              <h4>Draft Order</h4>
            </div>
            <div className='col-sm-4 fw-lighter fst-italic overflow-hidden'>
              <h6 className='border-bottom border-success'>Round</h6>
              <h6 >Pick</h6>
            </div>
            <div>
            </div>
          </div>
          {draftData.map(data =>
          <div key={data.team.Name + 'order' + data.round + data.pick} onClick={HandleFocus} team={data.team.ID}>
              <SlotBox
                pick={data.pick}
                round={data.round}
                team={data.team}
                highlight={data.highlight}
                smack={props.smacks.find(s => s.team === data.team.ID)}/>
          </div>)}
        </div>
  )
}

function SlotBox (props) {
  return (
    <div className='row p-2 rounded-3' style={{ backgroundColor: props.highlight }}>
      <div className='col'>
        <h6>{props.team.Name}</h6>
        <p className='overflow-hidden mb-1 rounded-3 bg-white text-break' style={{ maxHeight: '3em' }}>
          {props.smack.smack !== '' ? props.smack.smack : 'Talk Some Smack!'}
        </p>
      </div>
      <div className='col-sm-2'>
        <h6 className='border-bottom border-warning'>{props.round}</h6>
        <h6>{props.pick}</h6>
      </div>
    </div>
  )
}

// Since screen space is at a premium when dealing with supporting cell phone screens, I was thinking draft
// chat would be fixed at the bottom of the screen, and be a hybrid input/display.  Instead of displaying messages
// as a list, I was thinking we would treat them as 'reactions', and we would 'pulse' messages across the bottom area.
// So the idea is we gather chat messages, put them in a queue, then animate those messages crawling
// across the chat display area.  Once the animation ends, we pull the next messages on the queue, otherwise
// we'll just replay the animation until new chat messages are submitted.  Should be good for moments someone picking
// a kicker/defense too early, and I don't know if you miss much not being able to hold a regular discussion in a draft.
function DraftChat (props) {
  const [message, setMessage] = useState('')

  function submit (e) {
    e.preventDefault()
    props.chat(message)
    setMessage('')
  }

  function handleInput (e) {
    e.preventDefault()
    setMessage(e.target.value)
  }

  return (
    <div className='row position-sticky bottom-0 p-2' style={{ minWidth: '100%', maxHeight: '8em', backgroundColor: '#198754d0' }}>
      <div className='col-8 bg-white text-center'>
        {props.messages.length > 0
          ? <ChatHighlight message={props.messages[0]} progress={props.progress} />
          : '' }
      </div>
      <div className='col-4'>
        <form className='d-grid' onSubmit={submit}>
          <div className='form-floating'>
            <input id='chatInput' type='text' onChange={handleInput} value={message} className='form-control' placeholder='Talk Smack!' required/>
            <label htmlFor='chatInput'>Talk Smack!</label>
          </div>
          <button type='submit' className='btn btn-sm btn-info'>Chat</button>
        </form>
      </div>
    </div>
  )
}

// If we're going to incorporate a transition, we want to run it on as simple a component as possible.
function ChatHighlight (props) {
  useEffect(() => {
    const doAnimation = async () => {
      // If we start piling up messages, speed up the animations.  For now, we'll just halve the animation time
      // when we have more than 3 messages in queue
      const duration = props.message.length > 3 ? 1250 : 2500
      const highlight = document.querySelector('#chatHighlight')
      const anim = highlight.animate([
        { fontSize: 'xx-small', opacity: 1 },
        { fontSize: 'xx-large', opacity: 1, offset: 0.8 },
        { fontSize: 'xx-large', opacity: 0 }
      ], {
        duration: duration
      })
      const end = await anim.finished
      console.log(end)
      if (end.playState === 'finished') {
        props.progress()
      }
    }
    doAnimation()
      .catch(error => console.error(error))
  }, [props.message])

  return (
      <div className='row mt-3' id='chatHighlight'>
        <div className='col-3'>
          <p className='mb-0 fw-bold'>{props.message.team.Manager.name}</p>
        </div>
        <div className='col-9'>
          <p className='mb-0 text-break'>{props.message.message}</p>
        </div>
      </div>
  )
}

export default Draft
