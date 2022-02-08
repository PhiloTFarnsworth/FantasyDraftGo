'use strict'
import LeagueHome from './league.js'
import Notify, { NotifyContext, UserContext, csrftoken } from './util.js'
import React, { useState, useEffect, useContext } from 'react'

// The Lobby layer is where we want to house the general user interface.  While Lobby's main purpose is to funnel a user
// to a specific League, features like user settings (dark mode?) and general account messaging (Likely a bot to send messages
// informing users of invites to leagues) are a good fit for this layer.  While we're focusing primarily on a single type of
// fantasy sport, this would also be a good place to allow users to toggle between different sports offerings.
function Lobby () {
  const [leagueID, setLeagueID] = useState(0)
  const User = useContext(UserContext)

  if (leagueID !== 0) {
    return (
      <div className='bg-white p-2 m-2' style={{ minHeight: '80vh' }}>
        <LeagueHome openLeague={setLeagueID} ID={leagueID} />
      </div>
    )
  }

  return (
    <div className='bg-white p-2 m-2 text-center' style={{ minHeight: '80vh' }}>
      <h1 className='display-4 text-capitalize'>{User.name} Dashboard</h1>
      <div className='row'>
        <LeagueWizard openLeague={setLeagueID} />
      </div>
      <div className='row'>
        <h2 className='display-5'>Active Leagues</h2>
        <LeagueDirectory openLeague={setLeagueID} />
      </div>
    </div>
  )
}

function LeagueDirectory (props) {
  const [loading, setLoading] = useState(true)
  const [leagues, setLeagues] = useState([])
  const [invites, setInvites] = useState([])
  const [activeLeagues, setActiveLeagues] = useState([])
  const [activeView, setActiveView] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('/leagues', { method: 'GET' })
      const data = await response.json()

      if (data.leagues !== null) {
        const tmp = data.leagues.map(l => l)
        setActiveLeagues(tmp)
        setLeagues(tmp)
      }
      if (data.invites !== null) {
        const tmp = data.invites.map(l => l)
        setInvites(tmp)
      }
    }

    fetchData()
      .catch(error => console.log('fail:', error))

    setLoading(false)
  }, [])

  // Sometimes you just have to toggle a toggle
  function activeToggle () {
    if (activeView) {
      setActiveView(false)
      setLeagues(invites)
    } else {
      setActiveView(true)
      setLeagues(activeLeagues)
    }
  }

  if (loading) {
    return (
      <div>loading...</div>
    )
  }

  return (
    <div>
      <div>
        {activeView
          ? <div className='row d-grid'>
              <div className='btn-group' role='group' aria-label='Active/Completed draft toggle'>
                <button className='btn btn-dark' disabled>Leagues</button>
                <button className='btn btn-warning' onClick={activeToggle}>Invites</button>
              </div>
              <ActiveLeagues leagues={leagues} openLeague={props.openLeague} />
            </div>
          : <div className='row d-grid'>
              <div className='btn-group' role='group'>
                <button className='btn btn-warning' onClick={activeToggle}>Leagues</button>
                <button className='btn btn-dark' disabled>Invites</button>
              </div>
                <Invitations leagues={leagues} openLeague={props.openLeague} />
              </div>
        }
      </div>
    </div>
  )
}

function ActiveLeagues (props) {
  function openLeague (e) {
    e.preventDefault()
    props.openLeague(e.target.id)
  }

  return (
        <table className='table text-center'>
          <thead>
          <th colSpan={2}>League</th><th colSpan={2}>Commissioner</th><th colSpan={1}></th>
              </thead>
          <tbody>
            {props.leagues.map(league =>
                <tr key={'active_' + league.ID}>
                  <td colSpan={2} className='text-center'>{league.Name}</td>
                  <td colSpan={2}>{league.Commissioner}</td>
                  <td colSpan={1}><button className='btn btn-success btn-sm' id={league.ID} onClick={openLeague}> Rejoin!</button></td>
                </tr>
            )}
          </tbody>
        </table>
  )
}

function Invitations (props) {
  const [selection, setSelection] = useState(0)

  function selectInvite (e) {
    e.preventDefault()
    const numeral = parseInt(e.target.id, 10)
    setSelection(numeral)
  }

  function clearSelection () {
    setSelection(0)
  }

  if (selection === 0) {
    return (
            <table className='table text-center'>
              <thead>
                <th colSpan={2}>League</th><th colSpan={2}>Commissioner</th><th colSpan={1}></th>
              </thead>
              <tbody>
                {props.leagues.map(league =>
                    <tr key={'leagues_' + league.ID}>
                        <td colSpan={2}>{league.Name}</td>
                        <td colSpan={2}>{league.Commissioner}</td>
                        <td colSpan={1}><button className='btn btn-success btn-sm' id={league.ID} onClick={selectInvite}>Join!</button></td>
                    </tr>
                )}
              </tbody>
            </table>
    )
  }

  return (
        <TeamWizard openLeague={props.openLeague} league={selection} close={clearSelection} />
  )
}

// League wizard will be a simple interface for creating a fantasy league, where users can customize some aspects of the league.
// We'll try to keep this to the most basic set of options, but should probably at least mock up some place for advanced options.
// These options should be rules for the league that should be set in stone before the league drafts (number of teams in league,
// draft rules), but until the draft the commissioner should have the ability to edit these values.
function LeagueWizard (props) {
  const [open, setOpen] = useState(false)
  const [maxOwner, setMaxOwner] = useState(1)
  const [leagueName, setLeagueName] = useState('')
  const [teamName, setTeamName] = useState('')

  function toggleFocus (e) {
    e.preventDefault()
    if (!open) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  function handleTeamName (e) {
    e.preventDefault()
    setTeamName(e.target.value)
  }

  function handleLeagueName (e) {
    e.preventDefault()
    setLeagueName(e.target.value)
  }

  function handleMaxOwner (e) {
    e.preventDefault()
    const numeral = parseInt(e.target.value, 10)
    setMaxOwner(numeral)
  }

  // We want to create a league in our database, then we'll return the relevant league properties to the lobby level,
  // Where we can use those properties to create a league layer.
  function createLeague (e) {
    e.preventDefault()
    const fetchData = async () => {
      const response = await fetch('/createleague', {
        method: 'POST',
        body: JSON.stringify({ maxOwner: maxOwner, league: leagueName, team: teamName }),
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/JSON'
        }
      })
      const data = await response.json()

      if (response.ok) {
        props.openLeague(data.leagueID)
      } else {
        Notify('Draft Creation Unsuccessful', 0)
      }
    }

    fetchData()
      .catch(error => console.error(error))
  }

  if (!open) {
    return (
            <div className='d-grid'>
                <button className='btn btn-success' onClick={toggleFocus}>Create a New League</button>
            </div>
    )
  }
  return (
    <div>
      <div className='d-grid'>
        <button className='btn btn-danger btn-sm' onClick={toggleFocus}>Close League Wizard</button>
      </div>
      <h2 className='display-5'>Create a League!</h2>
      <form onSubmit={createLeague}>
        <div className='form-floating mb-3'>
          <input name="leagueName" id='leagueName' type='text' className='form-control' onChange={handleLeagueName} placeholder='Name Your League!' required/>
          <label htmlFor='leagueName'>Name Your League!</label>
        </div>
        <div className='mb-3'>
          <label htmlFor='teams' className='display-6'>Teams: {maxOwner}</label>
          <input name="teams" className='form-range' onChange={handleMaxOwner} type='range' min='1' max='14' value={maxOwner}/>
        </div>
        <div className='form-floating mb-3'>
          <input name="teamName" id='teamName' type='text' className='form-control' onChange={handleTeamName} placeholder='Name Your Team!' required/>
          <label htmlFor='teamName' >Name Your Team!</label>
        </div>
          <div className='d-grid'>
            <button className='btn btn-success' type='submit'> Create League! </button>
          </div>
      </form>
    </div>
  )
}

function TeamWizard (props) {
  // We'll elevate this prop when a a user clicks an invite.  The user will name their team, and then be redirected to their
  // new league's page.  As we add more customization options to teams this might expand, but for now it's very simple.
  const [teamName, setTeamName] = useState('')
  const Notify = useContext(NotifyContext)

  function handleChange (e) {
    setTeamName(e.target.value)
  }

  function close (e) {
    e.preventDefault()
    props.close()
  }

  function submit (e) {
    e.preventDefault()
    const fetchData = async () => {
      const response = await fetch('/joinleague', {
        method: 'POST',
        body: JSON.stringify({ league: props.league, team: teamName }),
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/JSON'
        }
      })
      const data = await response.json()

      if (response.ok) {
        props.openLeague(props.league)
      } else {
        Notify(data.error, 0)
      }
    }
    fetchData()
      .catch(error => console.error(error))
  }

  return (
        <form onSubmit={submit}>
            <button className='btn-close btn-close' onClick={close}></button>
            <div className='form-floating mb-3'>
            <input type="text" id="teamNameCreate" onChange={handleChange} className="form-control" placeholder="Team Name" required></input>
            <label htmlFor='teamNameCreate'>Team Name</label>
            </div>
            <button type="submit">Create Team</button>
        </form>
  )
}

export default Lobby
