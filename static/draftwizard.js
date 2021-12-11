const { useState, useEffect } = React;

function FastDraftInitiator(props) {
    const [open, setOpen] = useState(false)
    const [teams, setTeams] = useState(1)
    const [teamName, setTeamName] = useState('')
    const [leagueName, setLeagueName] = useState('')
    //const [draftPosition, setDraftPosition] = useState(1)
    const [initialized, setInitialized] = useState(false)
    const [rejoin, setRejoin] = useState(false)
    const [draftProps, setDraftProps] = useState({})

    function toggleOpen(e) {
        e.preventDefault()
        open ? setOpen(false) : setOpen(true)
    }

    function handleTeams(e) {
        e.preventDefault()
        setTeams(e.target.value)
        if (draftPosition > e.target.value) {
            setDraftPosition(e.target.value)
        }
    }

    function handleDraftPosition(e) {
        e.preventDefault()
        setDraftPosition(e.target.value)
    }

    function handleTeamName(e) {
        e.preventDefault()
        setTeamName(e.target.value)
    }

    function handleLeagueName(e) {
        e.preventDefault()
        setLeagueName(e.target.value)
    }

    function startDraft(e) {
        e.preventDefault()
        let csrftoken = getCookie('csrftoken')
        fetch('/initializeDraft', {
            method: 'POST',
            body: JSON.stringify({ teams: teams, position: draftPosition, name: teamName, league: leagueName }),
            headers: {
                'X-CSRFToken': csrftoken,
                'Content-Type': 'Application/JSON'
            }
        })
            .then(response => response.json())
            //data will carry our league's ID and the list of teams in order of their first round draft position.
            .then(data => {
                setDraftProps(data)
                setInitialized(true)
            })
            .catch(error => console.log('fail:', error))
    }

    function rejoinDraft(league_id, team_id) {
        // need to get team and league id
        let csrftoken = getCookie('csrftoken')
        fetch('rejoin_draft', {
            method: 'POST',
            body: JSON.stringify({ 'league_id': league_id, 'team_id': team_id }),
            headers: { 'X-CSRFToken': csrftoken, 'Content-Type': 'Application/JSON' }
        })
            .then(response => response.json())
            .then(data => {
                setDraftProps(data)
                setRejoin(true)
            })
            .catch(error => console.log('fail:', error))
    }

    if (rejoin) {
        return <Draft leagueID={draftProps.leagueID}
            teams={draftProps.teams}
            commissioner={draftProps.commissioner}
            teamControl={draftProps.teamControl}
            managers={draftProps.managers}
            user={props.user}
            history={JSON.parse(draftProps.history)}
            onError={props.onError}
            locked={draftProps.locked}
            onSuccess={props.onSuccess} />
    }

    //A player that initializes a draft is considered the commissioner and can chose when to start a draft.
    if (initialized) {
        return <Draft leagueID={draftProps.leagueID}
            teams={draftProps.teams}
            commissioner={draftProps.commissioner}
            teamControl={draftProps.commissioner}
            managers={draftProps.managers}
            user={props.user}
            history={[]}
            onError={props.onError}
            onSuccess={props.onSuccess} />
    }

    if (!open) {
        return (
            <div className='container'>
                <div className='row'>
                    <div className='col text-center'>
                        <h1 className='display-4'>Create a new draft!</h1>
                        <button className='btn btn-success' onClick={toggleOpen}>Fast Draft</button>
                        <p>Fast Draft provides a few essential options and gets you up and drafting quickly</p>
                        <button className='btn btn-light' disabled>Custom Draft</button>
                        <p>Custom Draft provides a large range of options to tailor your league's draft to your exacting tastes (Not Available)</p>
                        <button className='btn btn-light' disabled>Public Draft</button>
                        <p>Join other players from around the world in our public run leagues (Not Available)</p>
                    </div>
                    <DraftDirectory user={props.user} rejoin={rejoinDraft} />
                </div>
            </div>
        )
    } else {
        //Real range madness.  Sliders are not ideal but I enjoy moving them side to side
        return (
            <div className='container'>
                <div className='row'>
                    <div className='col text-center m-5 p-3 bg-light'>
                        <div className='d-flex justify-content-end'>
                            <button className='btn-close btn-close' onClick={toggleOpen}></button>
                        </div>
                        <h1 className='display-3'>Fast Draft</h1>
                        <form onSubmit={startDraft}>
                            <div className='row mx-2'>
                                <input className='form-range' onChange={handleTeams} type='range' min='1' max='14' value={teams}></input>
                                <p>Teams: </p><h3>{teams > 0 ? teams : 'Random'}</h3>
                                <input className='form-range' onChange={handleDraftPosition} type='range' min='1' max={teams} value={draftPosition}></input>
                                <p>Draft Position: </p><h3>{draftPosition > 0 ? draftPosition : 'Random'}</h3>
                            </div>
                            <div className='row d-grid gap-2 mb-2'>
                                <div className='col-auto'>
                                    <input type='text' className='form-control' onChange={handleTeamName} placeholder='Name Your Team!' required></input>
                                </div>
                                <div className='col-auto'>
                                    <input type='text' className='form-control' onChange={handleLeagueName} placeholder='Name Your League!'></input>
                                </div>
                            </div>
                            <div className='d-grid gap-2'>
                                <button className='btn btn-success' type='submit'> Start Draft! </button>
                            </div>
                        </form>
                    </div>
                    {/* <DraftDirectory user={props.user} rejoin={rejoinDraft} /> */}
                </div>
            </div>
        )
    }
}