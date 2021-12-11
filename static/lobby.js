const { useState, useEffect, useContext } = React;
//The Lobby layer is where we want to house the general user interface.  While Lobby's main purpose is to funnel a user
//to a specific League, features like user settings (dark mode?) and general account messaging (Likely a bot to send messages
//informing users of invites to leagues) are a good fit for this layer.  While we're focusing primarily on a single type of
//fantasy sport, this would also be a good place to allow users to toggle between different sports offerings.
function Lobby(props) {
    const [focus, setFocus] = useState('')
    const [leagueID, setLeagueID] = useState(0)

    const Notify = useContext(NotifyContext)

    //Reset focus when leagueID changes.
    useEffect(() => {
        setFocus('')
    }, [leagueID])

    if (leagueID != 0) {
        return (
            <div className='container'>
                <LeagueHome openLeague={setLeagueID} ID={leagueID} />
            </div>
        )
    }
    //Barf me a river.  This will hold for two items, but I'll need something better if we want more than two choices. 
    //should also aim for a way to hide the object as opposed to removing it as we shift focus.  leagues is a cheap query,
    //but no reason we should redo it each time we shift focus.
    return (
        <div className='container'>
            {focus == "wizard" ? '' : <LeagueDirectory inFocus={setFocus} openLeague={setLeagueID} />}
            {focus == "directory" ? '' : <LeagueWizard inFocus={setFocus} openLeague={setLeagueID} />}
        </div>
    )


}

function LeagueDirectory(props) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [leagues, setLeagues] = useState([])
    const [invites, setInvites] = useState([])
    const [activeLeagues, setActiveLeagues] = useState([])
    const [activeView, setActiveView] = useState(true)
    const User = useContext(UserContext)

    function toggleFocus(e) {
        e.preventDefault()
        if (!open) {
            setOpen(true)
            props.inFocus("directory")
        } else {
            setOpen(false)
            props.inFocus("")
        }
    }

    //Sometimes you just have to toggle a toggle
    function activeToggle() {
        if (activeView) {
            setActiveView(false)
            setLeagues(invites)
        } else {
            setActiveView(true)
            setLeagues(activeLeagues)
        }
    }

    useEffect(() => {
        let url = "/user/leagues/" + User.id
        fetch(url, { method: "GET" })
            .then(response => response.json())
            .then(data => {
                if (data.leagues !== null) {
                    let tmp = []
                    data.leagues.map(league => {
                        tmp.push(league)
                    })
                    setActiveLeagues(tmp)
                    setLeagues(tmp)
                }
                if (data.invites !== null) {
                    let tmp = []
                    data.invites.map(league => {
                        tmp.push(league)
                    })
                    setInvites(tmp)
                }
                setLoading(false)
            })
            .catch(error => console.log("fail:", error))
    }, [])


    if (!open) {
        return (
            <div>
                <button onClick={toggleFocus}>Select a League</button>
            </div>
        )
    }

    if (loading) {
        return (
            <div>loading...</div>
        )
    }

    return (
        <div>
            <button className='btn-close btn-close' onClick={toggleFocus}></button>
            <div>
                {activeView ?
                    <div>
                        <div className='btn-group' role='group' aria-label='Active/Completed draft toggle'>
                            <button className='btn btn-dark btn-sm' disabled>Leagues</button>
                            <button className='btn btn-warning btn-sm' onClick={activeToggle}>Invites</button>
                        </div>
                        <ActiveLeagues leagues={leagues} openLeague={props.openLeague} />
                    </div>
                    :
                    <div>
                        <div className='btn-group' role='group'>
                            <button className='btn btn-warning btn-sm' onClick={activeToggle}>Leagues</button>
                            <button className='btn btn-dark btn-sm' disabled>Invites</button>
                        </div>
                        <Invitations leagues={leagues} openLeague={props.openLeague} />
                    </div>
                }
            </div>
        </div>
    )
}

function ActiveLeagues(props) {
    function openLeague(e) {
        e.preventDefault()
        props.openLeague(e.target.id)
    }

    return (
        <div>
            {props.leagues.map(league =>
                <div key={"active_" + league.ID}>
                    <button id={league.ID} onClick={openLeague}> Go to {league.Name}</button>
                </div>
            )}
        </div>
    )
}

function Invitations(props) {
    const [selection, setSelection] = useState(0)

    function selectInvite(e) {
        e.preventDefault()
        setSelection(e.target.id)
    }

    function clearSelection() {
        setSelection(0)
    }

    if (selection === 0) {
        return (
            <div>
                {props.leagues.map(league =>
                    <div>
                        <button id={league.ID} onClick={selectInvite}>Join League {league.Name}</button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <TeamWizard openLeague={props.openLeague} league={selection} close={clearSelection} />
    )

}

//League wizard will be a simple interface for creating a fantasy league, where users can customize some aspects of the league.
//We'll try to keep this to the most basic set of options, but should probably at least mock up some place for advanced options.
//These options should be rules for the league that should be set in stone before the league drafts (number of teams in league,
//draft rules), but until the draft the commissioner should have the ability to edit these values.
function LeagueWizard(props) {
    const [open, setOpen] = useState(false)
    const [maxOwner, setMaxOwner] = useState(1)
    const [leagueName, setLeagueName] = useState('')
    const [teamName, setTeamName] = useState('')
    const User = useContext(UserContext)

    function toggleFocus(e) {
        e.preventDefault()
        if (!open) {
            setOpen(true)
            props.inFocus("wizard")
        } else {
            setOpen(false)
            props.inFocus("")
        }
    }

    function handleTeamName(e) {
        e.preventDefault()
        setTeamName(e.target.value)
    }

    function handleLeagueName(e) {
        e.preventDefault()
        setLeagueName(e.target.value)
    }

    function handleMaxOwner(e) {
        e.preventDefault()
        setMaxOwner(e.target.value)
    }

    //We want to create a league in our database, then we'll return the relevant league properties to the lobby level,
    //Where we can use those properties to create a league layer.
    function createLeague(e) {
        e.preventDefault()
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch('/createleague', {
            method: 'POST',
            body: JSON.stringify({ maxOwner: maxOwner, league: leagueName, name: teamName }),
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/JSON'
            }
        })
            .then(response => response.json())
            //data will carry our league's ID and the list of teams in order of their first round draft position.
            .then(data => {
                props.openLeague(data.leagueID)
            })
            .catch(error => console.log('fail:', error))
    }

    if (!open) {
        return (
            <div>
                <button onClick={toggleFocus}>Create a League</button>
            </div>
        )
    }
    return (
        <div>
            <button className='btn-close btn-close' onClick={toggleFocus}></button>
            <h3>Create a League!</h3>
            <form onSubmit={createLeague}>
                <input className='form-range' onChange={handleMaxOwner} type='range' min='1' max='14' value={maxOwner}></input>
                <p>Teams: </p><h3>{maxOwner}</h3>
                <input type='text' className='form-control' onChange={handleTeamName} placeholder='Name Your Team!' required></input>
                <input type='text' className='form-control' onChange={handleLeagueName} placeholder='Name Your League!' required></input>
                <button className='btn btn-success' type='submit'> Start Draft! </button>
            </form>
        </div>
    )
}

function TeamWizard(props) {
    //We'll elevate this prop when a a user clicks an invite.  The user will name their team, and then be redirected to their
    //new league's page.  As we add more customization options to teams this might expand, but for now it's very simple.
    const [teamName, setTeamName] = useState("")
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)

    function handleChange(e) {
        setTeamName(e.target.value)
    }

    function close(e) {
        e.preventDefault()
        props.close()
    }

    function submit(e) {
        e.preventDefault()
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/joinleague", {
            method: "POST",
            body: JSON.stringify({ league: props.league, team: teamName }),
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/JSON'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.ok == false) {
                    Notify(data.error, 0)
                } else {
                    props.openLeague(props.league)
                }
            })
            .catch(error => console.log(error))
    }


    return (
        <form onSubmit={submit}>
            <button onClick={close}>X</button>
            <input type="text" onChange={handleChange} placeholder="Team Name" required></input>
            <button type="submit"></button>
        </form>
    )
}