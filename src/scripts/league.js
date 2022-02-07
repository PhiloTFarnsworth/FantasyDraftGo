'use strict'
import Draft from './draft.js'
import { UserContext, NotifyContext, csrftoken } from './util.js'
import React, { useState, useEffect, useContext } from 'react'
// The ultimate layer is the League layer, where a user has specified a specific league
// and is returned a portal for that league.  From here we can access all the managerial options
// a user has access to as a team owner, as well as any information about the league.

// As it stands, we have 4 states we should concern ourselves with in this component, plus
// optional rendering for each state depending on whether the user is a commissioner of a league or not.

// INIT - This should display a list of users in the league, as well as potential invitees.  Commissioner
// Should be able to input a name or email and invite the user.
// PREDRAFT - All teams have joined a league and the commissioner has locked entry by new users.  This should
// Display information about the upcoming draft, and in future iterations some sort of draft tools.  Commissioner
// needs tools to set draft order, set a date and time for the draft to officially commence and change options.
// These settings should be visible to all users.  When draft is active, direct users to draft.
// DRAFT - This should lead straight to the draft component
// SEASON - This should be the most commonly seen view.  display standings, a little smack talk messenger,
// and links to teams, free agents and all that good stuff.
// COMPLETE - This should display end of the year awards and the like.  links should lead to non-interactive versions
// of links from the season screen.

// After some consultation with myself, I think a hierarchy is emerging.  All leagues need a header to identify
// the context as well as a league nav, then we will use our league states to identify a default component
// to display as the main content on the page.
function LeagueHome (props) {
  const [leagueProps, setLeagueProps] = useState({ ID: 0, name: '', state: '', maxOwner: 0, kind: '' })
  const [commissioner, setCommissioner] = useState({ ID: 0, name: '', email: '' })
  const [teams, setTeams] = useState([])
  const [invites, setInvites] = useState([])
  const [openSpots, setOpenSpots] = useState(0)
  const [loading, setLoading] = useState(true)
  const User = useContext(UserContext)
  const Notify = useContext(NotifyContext)

  // Init useEffect.  Since we load from a league ID, we want to populate our league props to determine user's
  // permissions and what state the league is in.
  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('/league/home/' + props.ID, { method: 'GET' })
      const ok = response.ok
      const data = await response.json()

      if (ok) {
        let count = 0
        if (data.teams != null) {
          setTeams(data.teams)
          count += data.teams.length
        }
        if (data.invites != null) {
          setInvites(data.invites)
          count += data.invites.length
        }
        if (count > data.league.MaxOwner) {
          setOpenSpots(0)
        } else {
          setOpenSpots(data.league.MaxOwner - count)
        }
        setCommissioner(data.league.Commissioner)
        setLeagueProps({ ID: data.league.ID, name: data.league.Name, state: data.league.State, maxOwner: data.league.MaxOwner, kind: data.league.Kind })
      } else {
        Notify(data, 0)
      }
    }

    fetchData()
      .catch(error => console.log('fail:', error))
    setLoading(false)
  }, [])

  useEffect(() => {
    const count = invites.length + teams.length
    if (count > leagueProps.maxOwner) {
      setOpenSpots(0)
      if (commissioner.ID === User.ID) {
        Notify('You have more Invites than open league slots.  Consider increasing the maximum number of owners in your league.', 0)
      }
    } else {
      setOpenSpots(leagueProps.maxOwner - count)
    }
  }, [leagueProps])

  function closeLeague () {
    props.openLeague(0)
  }

  function lockLeague (e) {
    e.preventDefault()
    const fetchData = async () => {
      const response = await fetch('/lockleague', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/json'
        },
        body: JSON.stringify({ league: leagueProps.ID })
      })
      const ok = response.ok
      const data = await response.json()

      if (ok) {
        const newProps = {
          ID: leagueProps.ID,
          name: leagueProps.name,
          state: data.state,
          maxOwner: leagueProps.maxOwner,
          kind: leagueProps.kind
        }
        setLeagueProps(newProps)
        Notify('League is now in draft mode, please review settings', 1)
      } else {
        Notify(data, 0)
      }
    }
    fetchData()
      .catch(error => console.log(error))
  }

  function startDraft (e) {
    e.preventDefault()
    const fetchData = async () => {
      const response = fetch('/startdraft', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/json'
        },
        body: JSON.stringify({ league: leagueProps.ID })
      })
      const data = await response.json()

      if (response.ok) {
        // Update league state
        const newProps = {
          ID: leagueProps.ID,
          name: leagueProps.name,
          state: 'DRAFT',
          maxOwner: leagueProps.maxOwner,
          kind: leagueProps.kind
        }
        setLeagueProps(newProps)
        // Update team draft order
        const updateTeams = [...teams]
        data.forEach(slot => {
          const index = updateTeams.findIndex(t => t.ID === slot.Team)
          updateTeams[index].Slot = slot.Slot
        })
        setTeams(updateTeams)
        Notify('Draft has begun!', 1)
      } else {
        Notify(data, 0)
      }
    }
    fetchData()
      .catch(error => console.error(error))
  }

  if (loading) {
    return <div>loading...</div>
  }

  // Since our league state is going to have a fair bit of control over how we render league home, I think we build
  // Our component based on that.  So many notes already and I have a feeling this'll be refactored greatly.
  switch (leagueProps.state) {
    case 'INIT':
      return (
                <div className='text-center'>
                    <div className='d-grid'><button className='btn btn-danger' onClick={closeLeague}>Return to Dashboard</button></div>
                    <h1 className='text-capitalize display-4 mb-2'>{leagueProps.name} League Page</h1>
                    <h2 className='display-5 mb-2'>League Invitations</h2>
                    <div className='border border-warning p-1 mb-3'>
                    <h3 className='display-6 mb-2'>Teams Confirmed</h3>
                    {teams.map(team => <TeamBox key={team.ID + '_team'} team={team} />)}
                    </div>
                    {invites.length > 0
                      ? <div className='border border-warning p-1 mb-3'>
                          <h3 className='display-6 mb-2'>Users Invited</h3>
                          {invites.map((invite, i) => i + teams.length < leagueProps.maxOwner ? <InviteBox key={'invite_' + i} index={i} commissioner={commissioner} invite={invite} /> : '')}
                        </div>
                      : ''}
                    {openSpots > 0 ? <h3 className='display-6 mb-2'>{openSpots} Slot{openSpots > 1 ? 's' : ''} Open</h3> : ''}
                    {[...Array(openSpots)].map((x, i) => <InviteBox key={'anon_invite_' + i} index={i} invite={null} commissioner={commissioner} league={leagueProps.ID} />)}
                    {openSpots === 0 && User.ID === commissioner.ID
                      ? <div className='d-grid mb-3'><button className='btn btn-success' onClick={lockLeague}>Lock League</button></div>
                      : ''}
                    <h2 className='display-5 mb-2'>Review League Settings</h2>
                    <LeagueSettings league={leagueProps} commissioner={commissioner} setLeague={setLeagueProps} />
                </div>
      )
    case 'PREDRAFT':
      return (
                <div>
                    <h1>Review Settings</h1>
                    <p>When satisfied, click start draft button to begin draft</p>
                    {User.ID === commissioner.ID ? <button onClick={startDraft}>Start Draft</button> : ''}
                    <DraftSettings league={leagueProps.ID} commissioner={commissioner} />
                </div>
      )
    case 'DRAFT':
      return <Draft league={leagueProps} teams={teams} />
    default:
      return null
  }
}

// Team Box should be a generic view of all top end team information.
function TeamBox (props) {
  const User = useContext(UserContext)
  return (
        <div id={props.team.ID + '_team'} className='row m-1 p-3 border-top border-warning'>
            <div className='col border-end border-success overflow-visible'>
              <p>{props.team.Name}</p>
            </div>
            <div className='col border-end border-success overflow-visible'>
              <p>{props.team.Manager.name}</p>
            </div>
            <div className='col border-end border-success overflow-visible'>
              <p>{props.team.Manager.email}</p>
            </div>
            <div className='col d-grid overflow-visible'>
              {props.team.Manager.ID === User.ID ? <button className='btn btn-warning'>Edit Team Name</button> : ''}
            </div>
        </div>
  )
}

function InviteBox (props) {
  const [invitee, setInvitee] = useState('')
  const [completeInvite, setCompleteInvite] = useState(null)
  const User = useContext(UserContext)
  const Notify = useContext(NotifyContext)

  function handleChange (e) {
    e.preventDefault()
    setInvitee(e.target.value)
  }
  function invite (e) {
    e.preventDefault()
    // Do a little verification on the front end.
    if (User.ID !== props.commissioner.ID) {
      Notify("Non-Commissioners can't invite users to league.", 0)
      return null
    }
    const fetchData = async () => {
      const response = await fetch('/invite', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/json'
        },
        body: JSON.stringify({ invitee: invitee, league: props.league })
      })
      const data = await response.json()

      if (response.ok) {
        setCompleteInvite(data)
      } else {
        Notify(data, 0)
      }
    }

    fetchData()
      .catch(error => console.error(error))
  }

  useEffect(() => {
    if (props.invite !== null) {
      setCompleteInvite(props.invite)
    }
  }, [])

  // If we have extra slots in a draft, we want to provide a little invite box where a user can add another user's
  // username or email and invite them to the league.
  if (completeInvite === null) {
    return (
      <form className='form-control bg-warning mb-3' onSubmit={invite}>
        <div className='form-floating'>
          <input id={'inviteName' + props.index} className='form-control' type='email' placeholder="Invitee Email" onChange={handleChange} required></input>
          <label htmlFor={'inviteName_' + props.index}>Invitee Email</label>
        </div>
        <div className='d-grid'>
          <button className='btn btn-success btn-lg' type='submit'>Invite!</button>
        </div>
      </form>
    )
  } else {
    return (
      <div className='row m-1 p-3 text-center mb-3 border-top border-warning'>
        <div className='col border-end border-success overflow-visible'>
          <p>{completeInvite.name}</p>
        </div>
        <div className='col border-end border-success overflow-visible'>
         <p>{completeInvite.email}</p>
        </div>
        <div className='col d-grid overflow-visible'>
          <button className='btn btn-danger btn-sm' disabled={User.ID !== props.commissioner.ID}>Revoke Invite</button>
        </div>
      </div>
    )
  }
}

function LeagueSettings (props) {
  const [maxOwner, setMaxOwner] = useState(0)
  const [leagueName, setLeagueName] = useState('')
  const [kind, setKind] = useState('')
  const [loading, setLoading] = useState(true)
  const User = useContext(UserContext)
  const Notify = useContext(NotifyContext)

  useEffect(() => {
    setMaxOwner(props.league.maxOwner)
    setLeagueName(props.league.name)
    setKind(props.league.kind)
    setLoading(false)
  }, [])

  function handleChange (e) {
    e.preventDefault()
    switch (e.target.name) {
      case 'leagueName':
        setLeagueName(e.target.value)
        break
      case 'kind':
        setKind(e.target.value)
        break
      default:
        setMaxOwner(e.target.valueAsNumber)
        break
    }
  }

  function submit (e) {
    e.preventDefault()
    const csrftoken = document.getElementById('CSRFToken').textContent
    const fetchData = async () => {
      const response = await fetch('/leaguesettings', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/json'
        },
        body: JSON.stringify({ league: props.league.ID, name: leagueName, maxOwner: maxOwner, kind: kind })
      })
      const data = await response.json()
      if (response.ok) {
        setMaxOwner(data.maxOwner)
        setLeagueName(data.name)
        props.setLeague({
          ID: props.league.ID,
          name: data.name,
          state: props.league.state,
          maxOwner: data.maxOwner,
          kind: data.league.kind
        })
        Notify('New Settings Saved', 1)
      } else {
        Notify(data, 0)
      }
    }

    fetchData()
      .catch(error => console.error(error))
  }

  if (loading) {
    return (
            <div>
                loading...
            </div>
    )
  }

  return (
    <div>
      <form className='form-control mb-3 bg-warning' onSubmit={submit}>
        <div className='row mb-3'>
          <div className='col form-floating'>
          <input id="NameSetting" type="text" className='form-control' value={leagueName} onChange={handleChange} placeholder='League Name' disabled={User.ID !== props.commissioner.ID}/>
          <label htmlFor="NameSetting">League Name</label>
          </div>
          <div className='col form-floating'>
          <input id='ownerSetting' type="number" className='form-control' max={16} min={2} value={maxOwner} onChange={handleChange} placeholder='Maximum Teams' disabled={User.ID !== props.commissioner.ID}/>
          <label htmlFor='ownerSetting'>Maximum Teams</label>
          </div>
        </div>
        <div className='mb-3 form-floating'>
          <select className='form-select' name="kind" id="leagueKind" placeholder='League Type' onChange={handleChange} value={kind} disabled={User.ID !== props.commissioner.ID}>
            <option value="TRAD">Traditional</option>
            <option value="TP">Total Points</option>
            <option value="ALLPLAY">All Play</option>
            <option value="PIRATE">Pirate</option>
            <option value="GUILLOTINE">Guillotine</option>
          </select>
          <label htmlFor='leagueKind'>League Type</label>
          </div>
          {User.ID === props.commissioner.ID
            ? <div className='d-grid mb-3'><button className='btn btn-success btn-lg' type="submit">Save Settings</button></div>
            : ''}
      </form>
    </div>
  )
}

// Considering the depth we get into for our settings, we're going to need a component for each of our big settings
// categories.  Draft settings is pretty simple.  We'll present a "kind" selection, which will toggle between two set
// defaults, and if the user selects custom they can have access to all the options in the table.
function DraftSettings (props) {
  const [settings, setSettings] = useState({ draft: {}, positional: {}, scoring: {} })
  const [loading, setLoading] = useState(true)
  const [dForm, setDForm] = useState([])
  const [pForm, setPForm] = useState([])
  const [sForm, setSForm] = useState([])
  const User = useContext(UserContext)
  const Notify = useContext(NotifyContext)

  // We should Identify which keys need which type of inputs.
  const selects = ['Kind', 'DraftOrder']
  const times = ['Time']
  const numbers = ['Rounds', 'DraftClock']
  // And we need to identify our keys for draft and positional.

  useEffect(() => {
    const fetchData = async () => {
      const url = '/league/settings/getdraft/' + props.league
      const response = await fetch(url, { method: 'GET' })
      const data = await response.json()

      if (response.ok) {
        setSettings(data)
      } else {
        Notify('Bad Request', 0)
      }
    }

    fetchData()
      .catch(error => console.error(error))
  }, [])

  useEffect(() => {
    formDraft()
    formPos()
    formScore()
  }, [settings])

  useEffect(() => {
    if (dForm.length > 0 && pForm.length > 0 && sForm.length > 0) {
      setLoading(false)
    }
  }, [dForm, pForm, sForm])

  function handleChange (e) {
    e.preventDefault()
    // This should work because settings contains no references.
    const newSettings = Object.assign({}, settings)
    const key = e.target.id.split('_')

    if (e.target.name.startsWith('Time')) {
      const current = settings[key[0]].Time.split('T')
      if (e.target.name === 'Time_date') {
        newSettings[key[0]].Time = e.target.value + 'T' + current[1] + ':00Z'
      } else {
        newSettings[key[0]].Time = current[0] + 'T' + e.target.value + ':00Z'
      }
    } else {
      // Okay, this should work, but only because our input types limit input
      // and we have no user defined strings that can break this.
      if (key.length > 2) {
        // Scoring settings should be floats with hundredths level precision.  Mostly for stuff like passing yards, which are usually
        // 1 point for every 25 yards (0.04)
        newSettings[key[0]][key[1]][e.target.name] = isNaN(parseFloat(e.target.value)) ? e.target.value : parseFloat(e.target.value)
      } else {
        // positional inputs, as well as rounds and draft clock
        newSettings[key[0]][e.target.name] = isNaN(parseInt(e.target.value)) ? e.target.value : parseInt(e.target.value)
      }
    }

    setSettings(newSettings)
  }

  function submit (e) {
    e.preventDefault()
    const fetchData = async () => {
      const response = await fetch('/league/settings/setdraft/' + props.league, {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/json'
        },
        body: JSON.stringify(settings)
      })
      const data = await response.json()

      if (response.ok) {
        Notify('Draft Settings Saved', 1)
      } else {
        Notify('Save failed due to: ' + data, 0)
      }
    }

    fetchData()
      .catch(error => console.error(error))
  }

  function findInputType (key) {
    if (selects.includes(key)) { return 'select' }
    if (times.includes(key)) { return 'time' }
    if (numbers.includes(key)) { return 'number' }
    return 'text'
  }

  function formPos () {
    const protoForm = []
    Object.entries(settings.positional).forEach(([key, value]) => {
      if (key === 'Kind') {
        protoForm.push(<label htmlFor={'positional_' + key}>{key}</label>)
        protoForm.push(
                    <select
                    key={'positional_' + key}
                    name={key}
                    id={'positional_' + key}
                    value={value}
                    onChange={handleChange}
                    disabled={User.ID !== props.commissioner.ID}>
                        <option value='TRAD'>Traditional</option>
                        <option value='IDP'>Individual Defensive Players</option>
                        <option value='CUSTOM'>Custom</option>
                    </select>
        )
      } else if (key === 'ID') {
        // Do nothing
      } else {
        protoForm.push(<label htmlFor={'positional_' + key}>{key}</label>)
        protoForm.push(<input
            type="number"
            name={key}
            id={'positional_' + key}
            value={value}
            max={12}
            step={1}
            onChange={handleChange}
            disabled={User.ID !== props.commissioner.ID}/>)
      }
    })
    setPForm(protoForm)
  }

  function formDraft () {
    const protoForm = []
    Object.entries(settings.draft).forEach(([key, value]) => {
      switch (findInputType(key)) {
        case 'select': {
          let selectMeat
          if (key === 'Kind') {
            selectMeat = [<option key="TRAD" value="TRAD">Traditional</option>, <option key="AUCTION" value="AUCTION">Auction</option>]
          } else {
            selectMeat = [<option key="SNAKE" value="SNAKE">Snake</option>, <option key="STRAIGHT" value="STRAIGHT">Straight</option>, <option key="CURSED" value="CURSED">Cursed</option>]
          }
          protoForm.push(<label htmlFor={'draft_' + key}>{key}</label>)
          protoForm.push(<select
          key={'draft_' + key}
          name={key} id={'draft_' + key}
          value={value}
          onChange={handleChange}
          disabled={User.ID !== props.commissioner.ID}>
                        {selectMeat.map(o => o)}
                    </select>)
          break }
        case 'number': {
          protoForm.push(<label htmlFor={'draft_' + key}>{key}</label>)
          protoForm.push(
                        <div>
                            <label htmlFor={'draft_' + key}>{key}</label>
                            <input
                            key={'draft_' + key}
                            type="number"
                            name={key}
                            id={'draft_' + key}
                            value={value}
                            onChange={handleChange}
                            disabled={User.ID !== props.commissioner.ID}/>
                        </div>)

          break }
        case 'time': {
          const today = new Date(Date.now()).toISOString().split('T')
          const split = value.split('T')
          protoForm.push(<label htmlFor={'draft_' + key}>{key}</label>)
          protoForm.push(
                        <div>
                            <label htmlFor={key + '_date'}>Draft Start</label>
                            <input type="date"
                            name={key + '_date'}
                            id={'draft_' + key + '_date'}
                            min={today[0]}
                            value={split[0]}
                            onChange={handleChange}
                            disabled={User.ID !== props.commissioner.ID}/>
                            <input type="time"
                            name={key + '_time'}
                            id={'draft_' + key + '_time'}
                            value={split[1].replace('Z', '')}
                            onChange={handleChange}
                            disabled={User.ID !== props.commissioner.ID}/>
                        </div>)

          break }
        default: {
          if (key !== 'ID') {
            protoForm.push(<label htmlFor={'draft_' + key}>{key}</label>)
            protoForm.push(<input type="text" name={key} id={'draft_' + key} value={value} onChange={handleChange} disabled={User.ID !== props.commissioner.ID}/>)
          }
        }
      }
    })
    setDForm(protoForm)
  }

  function formScore () {
    const protoForm = []
    Object.entries(settings.scoring).forEach(([key, value]) => {
      protoForm.push(<h3>{key}</h3>)
      Object.entries(value).forEach(([key2, value2]) => {
        if (key2 !== 'ID') {
          protoForm.push(<label htmlFor={'scoring_' + key + '_' + key2}>{key2}</label>)
          protoForm.push(<input
            type="number"
            name={key2}
            id={'scoring_' + key + '_' + key2}
            value={value2}
            max={12}
            step={0.01}
            onChange={handleChange}
            disabled={User.ID !== props.commissioner.ID}/>)
        }
      })
    })
    setSForm(protoForm)
  }

  if (loading) {
    return (
            <div>
                loading...
            </div>
    )
  }

  return (
        <div>
            <h1>Draft Settings</h1>
            <form name="draft" onSubmit={submit}>
                {dForm.map(s => s)}
                <h2>Positional Settings</h2>
                {pForm.map(s => s)}
                <h2>scoring settings</h2>
                {sForm.map(s => s)}
                {User.ID === props.commissioner.ID
                  ? <input type="submit" value="Change Draft settings" />
                  : ''}
            </form>
        </div>
  )
}

export default LeagueHome
