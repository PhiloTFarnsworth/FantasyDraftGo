const { useState, useEffect } = React;

//The Lobby layer is where we want to house the general user interface.  While Lobby's main purpose is to funnel a user
//to a specific League, features like user settings (dark mode?) and general account messaging (Likely a bot to send messages
//informing users of invites to leagues) are a good fit for this layer.  While we're focusing primarily on a single type of
//fantasy sport, this would also be a good place to allow users to toggle between different sports offerings.
function Lobby(props) {
    const [focus, setFocus] = useState('')
    const [leagueID, setLeagueID] = useState(0)

    //Reset focus when leagueID changes.
    useEffect(() => {
        setFocus('')
    }, [leagueID])

    if (leagueID != 0) {
        return(
            <div className='container'>
                <LeagueHome openLeague={setLeagueID} ID={leagueID} user={props.user}/>
            </div>
        )
    }
    //Barf me a river.  This will hold for two items, but I'll need something better if we want more than two choices. 
    //should also aim for a way to hide the object as opposed to removing it as we shift focus.  leagues is a cheap query,
    //but no reason we should redo it each time we shift focus.
    return(
        <div className='container'>
            {focus == "wizard" ? '' : <LeagueDirectory inFocus={setFocus} openLeague={setLeagueID} user={props.user}/>}
            {focus == "directory"? '' : <LeagueWizard inFocus={setFocus} openLeague={setLeagueID} user={props.user}/>}
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
        let url = "/user/leagues/" + props.user.id 
        fetch(url, {method: "GET"})
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
        .catch(error => console.log("fail:",error))  
    }, [])

    //use this for invites.
    function joinLeague(e) {
        e.preventDefault()
        //We'll fetch a post request to our server, sending user data and league id.
    }

    function gotoLeague(e) {
        e.preventDefault()
        props.openLeague(e.target.id)
    }



    if (!open) {
        return(
            <div>
                <button onClick={toggleFocus}>Select a League</button>
            </div>
        )
    }

    if (loading) {
        return(
            <div>loading...</div>
        )
    }

    return(
        <div>
            <button className='btn-close btn-close' onClick={toggleFocus}></button>
            <div>
                {activeView ? 
                    <div className='btn-group' role='group' aria-label='Active/Completed draft toggle'>         
                        <button className='btn btn-dark btn-sm' disabled>Leagues</button>
                        <button className='btn btn-warning btn-sm' onClick={activeToggle}>Invites</button>
                    </div> :
                    <div className='btn-group' role='group'>
                        <button className='btn btn-warning btn-sm' onClick={activeToggle}>Leagues</button>
                        <button className='btn btn-dark btn-sm' disabled>Invites</button>
                    </div>
                }
                {leagues.map(league=>
                    <div>
                        <p>{league.Name}</p> 
                        <button id={league.ID} onClick={gotoLeague}>Go to league</button>
                    </div>
                )}
            </div>
        </div>
    )

}

//League wizard will be a simple interface for creating a fantasy league, where users can customize some aspects of the league.
//We'll try to keep this to the most basic set of options, but should probably at least mock up some place for advanced options.
//These options should be rules for the league that should be set in stone before the league drafts (number of teams in league,
//draft rules), but until the draft the commissioner should have the ability to edit these values.
function LeagueWizard(props) {
    const [open, setOpen] = useState(false)
    const [ownerCount, setOwnerCount] = useState(1)
    const [leagueName, setLeagueName] = useState('')
    //Setting up the commissioner's team is probably not necessary on the first screen, but it feels appropriate.
    const [teamName, setTeamName] = useState('')
    
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

    function handleOwnerCount(e) {
        e.preventDefault()
        setOwnerCount(e.target.value)
    }

    //We want to create a league in our database, then we'll return the relevant league properties to the lobby level,
    //Where we can use those properties to create a league layer.
    function createLeague(e) {
        e.preventDefault()
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch('/createLeague', {
            method: 'POST',
            body: JSON.stringify({ownerCount: ownerCount, league: leagueName, name: teamName, user: props.user}),
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
        return(
            <div>
                <button onClick={toggleFocus}>Create a League</button>
            </div>
        )
    }
    return(
        <div>
            <button className='btn-close btn-close' onClick={toggleFocus}></button>
            <h3>Create a League!</h3>
            <form onSubmit={createLeague}>
            <input className='form-range' onChange={handleOwnerCount} type='range' min='1' max='14' value={ownerCount}></input>
            <p>Teams: </p><h3>{ownerCount}</h3>
            <input type='text' className='form-control' onChange={handleTeamName} placeholder='Name Your Team!' required></input>
            <input type='text' className='form-control' onChange={handleLeagueName} placeholder='Name Your League!' required></input>
            <button className='btn btn-success' type='submit'> Start Draft! </button>
            </form>
        </div>
    )
}