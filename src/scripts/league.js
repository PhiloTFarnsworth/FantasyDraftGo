'use strict'
import Draft from './draft.js'
import { UserContext, NotifyContext } from './util.js'
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
    const url = '/league/home/' + props.ID
    fetch(url, { method: 'GET' })
      .then(response => response.json())
      .then(data => {
        if (data.ok == false) {
          Notify(data.error, 0)
        } else {
          setCommissioner(data.league.Commissioner)
          setLeagueProps({ ID: data.league.ID, name: data.league.Name, state: data.league.State, maxOwner: data.league.MaxOwner, kind: data.league.Kind })
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
          setLoading(false)
        }
      })
      .catch(error => console.error(error))
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
    const csrftoken = document.getElementById('CSRFToken').textContent
    fetch('/lockleague', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': csrftoken,
        'Content-Type': 'Application/json'
      },
      body: JSON.stringify({ league: leagueProps.ID })
    })
      .then(response => response.json())
      .then(data => {
        if (data.ok == false) {
          Notify(data.error, 0)
        } else {
          const newProps = {
            ID: leagueProps.ID,
            name: leagueProps.name,
            state: data.state,
            maxOwner: leagueProps.maxOwner,
            kind: leagueProps.kind
          }
          setLeagueProps(newProps)
          Notify('League is now in draft mode, please review settings', 1)
        }
      })
      .catch(error => console.error(error))
  }

  function startDraft (e) {
    e.preventDefault()
    const csrftoken = document.getElementById('CSRFToken').textContent
    fetch('/startdraft', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': csrftoken,
        'Content-Type': 'Application/json'
      },
      body: JSON.stringify({ league: leagueProps.ID })
    })
      .then(response => response.json())
      .then(data => {
        if (data.ok == false) {
          Notify(data.error, 0)
        } else {
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
        }
      })
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
                <div>
                    <button className='btn-close btn-close' onClick={closeLeague}></button>
                    Welcome!
                    <h1>{leagueProps.name}</h1>
                    {teams.map(team => <TeamBox key={team.ID + '_team'} team={team} />)}
                    {invites.map((invite, i) => i + teams.length < leagueProps.maxOwner ? <InviteBox key={'invite_' + i} invite={invite} /> : '')}
                    {[...Array(openSpots)].map((x, i) => <InviteBox key={'anon_invite_' + i} invite={null} commissioner={commissioner} league={leagueProps.ID} />)}
                    {openSpots === 0 && User.ID === commissioner.ID ? <button onClick={lockLeague}>Lock League</button> : ''}
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
  return (
        <div id={props.team.ID + '_team'}>
            {props.team.Name} - {props.team.Manager.name} ({props.team.Manager.email})
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
    const csrftoken = document.getElementById('CSRFToken').textContent
    fetch('/invite', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': csrftoken,
        'Content-Type': 'Application/json'
      },
      body: JSON.stringify({ invitee: invitee, league: props.league })
    })
      .then(response => response.json())
      .then(data => {
        if (data.ok == false) {
          Notify(data.error, 0)
        } else {
          setCompleteInvite(data)
        }
      })
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
            <div>
                <form onSubmit={invite}>
                    <input type='email' placeholder="email" onChange={handleChange} required></input>
                    <button type='submit'>Invite!</button>
                </form>
            </div>)
  } else {
    return (
            <div>
                {completeInvite.name} - ({completeInvite.email})
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
    fetch('/leaguesettings', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': csrftoken,
        'Content-Type': 'Application/json'
      },
      body: JSON.stringify({ league: props.league.ID, name: leagueName, maxOwner: maxOwner, kind: kind })
    })
      .then(response => response.json())
      .then(data => {
        if (data.ok == false) {
          Notify(data.error, 0)
        } else {
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
        }
      })
      .catch(error => console.error(error))
  }

  if (loading) {
    return (
            <div>
                loading...
            </div>
    )
  }

  // Commish view. Max at 16?  why not?
  return (
        <div>
            <h1>League Settings</h1>
            <form onSubmit={submit}>
                <label htmlFor="leagueName">League Name:</label>
                <input name="leagueName" type="text" value={leagueName} onChange={handleChange} disabled={User.ID !== props.commissioner.ID}></input>
                <label htmlFor='maxOwner'>Maximum Teams:</label>
                <input name="maxOwner" type="number" max={16} min={2} value={maxOwner} onChange={handleChange} disabled={User.ID !== props.commissioner.ID}></input>
                <label htmlFor='kind'>League Type:</label>
                <select name="kind" id="league_kind" onChange={handleChange} value={kind} disabled={User.ID !== props.commissioner.ID}>
                    <option value="TRAD">Traditional</option>
                    <option value="TP">Total Points</option>
                    <option value="ALLPLAY">All Play</option>
                    <option value="PIRATE">Pirate</option>
                    <option value="GUILLOTINE">Guillotine</option>
                </select>
                {User.ID === props.commissioner.ID
                  ? <button type="submit">Save Settings</button>
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
    const url = '/league/settings/getdraft/' + props.league
    fetch(url, { method: 'GET' })
      .then(response => response.json())
      .then(data => {
        setSettings(data)
      })
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
    const csrftoken = document.getElementById('CSRFToken').textContent
    fetch('/league/settings/setdraft/' + props.league, {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': csrftoken,
        'Content-Type': 'Application/json'
      },
      body: JSON.stringify(settings)
    })
      .then(response => response.json())
      .then(data => {
        if (data.ok != false) {
          Notify('Draft Settings Saved', 1)
        } else {
          Notify('Save failed due to: ' + data.error, 0)
        }
      })
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

// Setting a draft order is a neat feature, but this approach has been finicky. Likely want to
// just integrate a third party library to assign teams to slots with a click and drag interface,
// as multiple vanilla html selects are clunky.

// //We'll allow commissioners to set their own league draft orders, and otherwise we'll create
// //a random ordering.  We should probably create order on league lock, display and allow editing
// //during the predraft portion.
// function DraftOrder(props) {
//     const [order, setOrder] = useState(new Array(props.teams.length))
//     const [unassigned, setUnassigned] = useState([])
//     const [loading, setLoading] = useState(true)
//     const User = useContext(UserContext)
//     const Notify = useContext(NotifyContext)

//     //So order is stored in props.teams, but if any team has a Slot: 0, then we should treat
//     //all teams as unordered
//     useEffect(() => {
//         if (props.teams.some(t => t.Slot === 0)) {
//             let newUnassigned = props.teams.map(t => t)
//             setUnassigned(newUnassigned)
//         } else {
//             let newOrder = [...order]
//             props.teams.forEach(t => newOrder[t.Slot] = t)
//             setOrder(newOrder)
//         }
//         setLoading(false)
//     }, []);

//     //We'll grab the length of props.teams, then randomly toss out numbers until we've assigned each team.
//     function generateRandomOrder(e) {
//         e.preventDefault()
//         let min = 1
//         let max = props.teams.length
//         let slots = []
//         let randOrder = []
//         //There's likely a better way, but we'll assign positions to an array.
//         for (let i = 0; i < max; i++) {
//             slots.push(i)
//         }
//         //Then, we'll pull indexes at random, splicing them from the slots array into the 'newOrder' array,
//         //reducing the max by 1 until we have all numbers assigned.
//         while (min <= max) {
//             //See math.random in the mdn documentation
//             let rand = Math.floor(Math.random() * ((max+1)-min))
//             let s = slots.splice(rand, 1)
//             randOrder.push(s)
//             max = slots.length
//         }
//         //Finally, with all draft slots distributed, set our new order
//         let newOrder = [...order]
//         for (let i = 0; i < newOrder.length; i++) {
//             newOrder[i] = props.teams[randOrder[i]]
//         }
//         //We set our order to the generated order
//         setOrder(newOrder)
//         //Finally, we take our new order and make it agree with the team/spot layout we have in
//         //the sql.
//         let serverOrder = []
//         for (let i=0; i< newOrder.length; i++) {
//             serverOrder.push({Team: newOrder[i].ID, Slot: i + 1})
//         }
//         //Then submit it to the server
//         setOrderServerside(serverOrder)
//     }

//     function setOrderServerside(newOrder) {
//         let csrftoken = document.getElementById('CSRFToken').textContent
//         fetch("/league/setorder/" + props.league.ID, {
//             method: "POST",
//             headers: {
//                 'X-CSRF-TOKEN': csrftoken,
//                 'Content-Type': 'Application/json'
//             },
//             body: JSON.stringify(newOrder)
//         })
//         .then(response => response.json())
//         .then(data => {
//             if (data.ok != false) {
//                 Notify("Draft Order Set", 1)
//             } else {
//                 Notify("Draft Order failure: " + data.error, 0)
//             }})
//         .catch(error => console.log(error))
//     }

//     //What we do here is we remove the team from unassigned, lock the team in the slot and add it to our draft order
//     //list.
//     function lockSlot(e) {
//         e.preventDefault()
//         //First, we grab the ID of the select that holds the users choice.  the integer after 'draft_order_lock_' contains
//         //is shared with the select field draft_order_, so we can grab the users choice of team.
//         let chosenID = document.querySelector('#draft_order_' + e.target.id.replace("draft_order_lock_", "")).value
//         let index
//         let choice
//         for (let i = 0; i < unassigned.length; i++) {
//             if (chosenID == unassigned[i].ID) {
//                 index = i
//                 choice = unassigned[i]
//                 break
//             }
//         }
//         //Take the chosen team out of unassigned
//         let newUnassigned = [...unassigned]
//         newUnassigned.splice(index, 1)
//         setUnassigned(newUnassigned)

//         //add the new locked order
//         let newOrder = [...order]
//         newOrder[i] = choice
//         setOrder(newOrder)
//     }

//     function unlockSlot(e) {
//         e.preventDefault()
//         let chosenID = document.querySelector('#draft_order_' + e.target.id.replace("draft_order_lock_", "")).value
//         //I'm pretty sure this is a trillion dollar mistake, but we'll create a new order array,
//         //then assign (not push) all but the unlocked slot to the new order.  This will leave our
//         //slot as undefined, which we'll use to filter out whether a slot is locked/set or not.  In
//         //most contexts this makes no sense, but since we already have to copy a new array to set
//         //order, it makes a little sense.
//         let newOrder = []
//         let newUnassigned = [...unassigned]
//         for (let i = 0; i < props.teams.length; i++) {
//             if (order[i] != chosenID) {
//                 newOrder[i] = order[i]
//             } else {
//                 newUnassigned.push(order[i])
//             }
//         }
//         setOrder(newOrder)
//         setUnassigned(newUnassigned)
//     }

//     if (loading) {
//         return <div>loading...</div>
//     }

//     //Far from ideal, but we'll have the user chose between generating a Random order, or assigning the slots
//     //for each team.  Each unassigned slot will have the pick number followed by a select containing each team
//     //not yet assigned to another slot.  When a user has assigned all teams (by locking their draft position),
//     //the 'set order' submit button will become enabled, allowing the user to submit the order for the server.
//     // if (order.some(t => t === null || t === undefined)) {
//         return(
//             <div>
//                 <h1>Set draft order</h1>
//                 <button onClick={generateRandomOrder}>Generate Random Order</button>

//                 <div>--OR-- *this should collapse or smth*</div>
//                 <form onSubmit={setOrderServerside}>
//                 {order.map((_, i) => {
//                     <SelectDistinct
//                     unassigned={unassigned}
//                     slot={i+1}
//                     order={order}
//                     lock={lockSlot}
//                     unlock={unlockSlot}/>
//                 })}
//                 {unassigned.length > 0
//                 ? <button type="submit" disabled>Set Order!</button>
//                 : <button type="submit">Set Order!</button>}

//                 </form>
//             </div>

//         )
//     // }

//     // return(
//     //     <div>
//     //         <ol>
//     //             {order.map(o => <li>{o.Slot} - {o.team.name} Manager: {o.team.Manager.Name}</li>)}
//     //         </ol>
//     //     </div>
//     // )
// }

// //So the idea here is we want to select a distinct team for each slot.  We'll pass our list of unassigned
// //teams, along with the team select (if exists).
// function SelectDistinct(props) {
//     const [locked, setLocked] = useState(false)

//     useEffect(() => {
//         if (props.order[props.slot - 1] != null) {
//             setLocked(true)
//         }
//     }, []);

//     if (locked) {
//         return(
//             <div>
//                 <p> #{props.slot} Pick: {props.order[props.slot].Team} - {props.order[props.slot].Manager.name}</p>
//             </div>
//         )
//     } else {
//         return(
//             <div>
//                 <label for={"draft_order_" + i}>#{i+1} Pick</label>
//                 <select id={"draft_order_" + i}>
//                     {props.unassigned.map(t => <option value={t.ID}>{t.Name} - {t.Manager.Name}</option>)}
//                 </select>
//                 <button onClick={lockSlot} id={"draft_order_lock_" + i}>Lock Draft Position</button>
//             </div>
//         )
//     }
// }
