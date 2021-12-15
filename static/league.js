const { useState, useEffect, useContext } = React;
//The ultimate layer is the League layer, where a user has specified a specific league
//and is returned a portal for that league.  From here we can access all the managerial options
//a user has access to as a team owner, as well as any information about the league.

//As it stands, we have 4 states we should concern ourselves with in this component, plus
//optional rendering for each state depending on whether the user is a commissioner of a league or not.

//INIT - This should display a list of users in the league, as well as potential invitees.  Commissioner 
//Should be able to input a name or email and invite the user.
//DRAFT - All teams have joined a league and the commissioner has locked entry by new users.  This should
//Display information about the upcoming draft, and in future iterations some sort of draft tools.  Commissioner
//needs tools to set draft order, set a date and time for the draft to officially commence and change options.
//These settings should be visible to all users.  When draft is active, direct users to draft.
//INPROGRESS - This should be the most commonly seen view.  display standings, a little smack talk messenger,
//and links to teams, free agents and all that good stuff.  
//COMPLETE - This should display end of the year awards and the like.  links should lead to non-interactive versions
//of links from the inprogress screen.

//After some consultation with myself, I think a hierarchy is emerging.  All leagues need a header to identify
//the context as well as a league nav, then we will use our league states to identify a default component
//to display as the main content on the page. 
function LeagueHome(props) {
    const [leagueProps, setLeagueProps] = useState({ id: 0, name: "", state: "", maxOwner: 0 })
    const [commissioner, setCommissioner] = useState({ id: 0, name: "", email: "" })
    const [teams, setTeams] = useState([])
    const [invites, setInvites] = useState([])
    const [openSpots, setOpenSpots] = useState(0)
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)

    //Init useEffect.  Since we load from a league ID, we want to populate our league props to determine user's
    //permissions and what state the league is in.
    useEffect(() => {
        let url = "/league/home/" + props.ID
        fetch(url, { method: "GET" })
            .then(response => response.json())
            .then(data => {
                if (data.ok == false) {
                    Notify(data.error, 0)
                } else {
                    setCommissioner(data.league.Commissioner)
                    setLeagueProps({ id: data.league.ID, name: data.league.Name, state: data.league.State, maxOwner: data.league.MaxOwner })
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
                }
            })
            .catch(error => console.error(error))
    }, [])

    useEffect(() => {
        let count = invites.length + teams.length
        if (count > leagueProps.maxOwner) {
            setOpenSpots(0)
            if (commissioner.id == User.id) {
                Notify("You have more Invites than open league slots.  Consider increasing the maximum number of owners in your league.", 0)
            }
        } else {
            setOpenSpots(leagueProps.maxOwner - count)
        }
    }, [leagueProps])


    function closeLeague() {
        props.openLeague(0)
    }

    function lockLeague(e) {
        e.preventDefault()
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/lockleague", {
            method: "POST",
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/json'
            },
            body: JSON.stringify({ league: leagueProps.id })
        })
            .then(response => response.json())
            .then(data => {
                if (data.ok == false) {
                    Notify(data.error, 0)
                } else {
                    let newProps = {
                        id: leagueProps.id,
                        name: leagueProps.name,
                        state: data.state,
                        maxOwner: leagueProps.maxOwner
                    }
                    setLeagueProps(newProps)
                    Notify("League is now in draft mode, please review settings", 1)
                }
            })
            .catch(error => console.error(error))
    }

    //Since our league state is going to have a fair bit of control over how we render league home, I think we build
    //Our component based on that.  So many notes already and I have a feeling this'll be refactored greatly.
    switch (leagueProps.state) {
        case "INIT":
            return (
                <div>
                    <button className='btn-close btn-close' onClick={closeLeague}></button>
                    Welcome!
                    <h1>{leagueProps.name}</h1>
                    {teams.map(team => <TeamBox key={team.ID + "_team"} team={team} />)}
                    {invites.map((invite, i) => i + teams.length < leagueProps.maxOwner ? <InviteBox key={"invite_" + i} invite={invite} /> : "")}
                    {[...Array(openSpots)].map((x, i) => <InviteBox key={"anon_invite_" + i} invite={null} commissioner={commissioner} league={leagueProps.id} />)}
                    {openSpots == 0 ? <button onClick={lockLeague}>Lock League</button> : ""}
                    <LeagueSettings league={leagueProps} commissioner={commissioner} setLeague={setLeagueProps} />
                </div>
            )
        default:
            return( 
                <div>
                    <DraftSettings league={leagueProps.id} commissioner={commissioner} />
                    <ScoringSettings league={leagueProps.id} commissioner={commissioner} />   
                </div>
            )
    }
}

//Team Box should be a generic view of all top end team information.  
function TeamBox(props) {
    return (
        <div id={props.team.id + "_team"}>
            {props.team.Name} - {props.team.Manager.name} ({props.team.Manager.email})
        </div>
    )
}

function InviteBox(props) {
    const [invitee, setInvitee] = useState("")
    const [completeInvite, setCompleteInvite] = useState(null)
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)

    function handleChange(e) {
        e.preventDefault()
        setInvitee(e.target.value)
    }
    function invite(e) {
        e.preventDefault()
        //Do a little verification on the front end.
        if (User.id != props.commissioner.id) {
            Notify("Non-Commissioners can't invite users to league.", 0)
            return null
        }
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/invite", {
            method: "POST",
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/json'
            },
            body: JSON.stringify({ "invitee": invitee, "league": props.league })
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

    //If we have extra slots in a draft, we want to provide a little invite box where a user can add another user's
    //username or email and invite them to the league.
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

function LeagueSettings(props) {
    const [maxOwner, setMaxOwner] = useState(0)
    const [leagueName, setLeagueName] = useState("")
    const [kind, setKind] = useState("")
    const [loading, setLoading] = useState(true)
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)

    useEffect(() => {
        setMaxOwner(props.league.maxOwner)
        setLeagueName(props.league.name)
        setKind(props.league.kind)
        setLoading(false)
    }, [])

    function handleChange(e) {
        e.preventDefault()
        switch (e.target.name) {
            case "leagueName":
                setLeagueName(e.target.value)
                break;
            case "kind":
                setKind(e.target.value)
                break;
            default:
                setMaxOwner(e.target.value)
                break;
        }
    }

    function submit(e) {
        e.preventDefault()
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/leaguesettings", {
            method: "POST",
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/json'
            },
            body: JSON.stringify({ league: props.league.id, name: leagueName, maxOwner: maxOwner, kind: kind })
        })
            .then(response => response.json())
            .then(data => {
                if (data.ok == false) {
                    Notify(data.error, 0)
                } else {
                    setMaxOwner(data.maxOwner)
                    setLeagueName(data.name)
                    props.setLeague({
                        id: props.league.id,
                        name: data.name,
                        state: props.league.state,
                        maxOwner: data.maxOwner
                    })
                    Notify("New Settings Saved", 1)
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
    //Static view
    if (User.id !== props.commissioner.id) {
        return (
            <div>
                <h1>League Settings</h1>
                <div>
                    <h2>{props.league.name}</h2>
                    <p>maxOwners:{props.league.maxOwner}</p>
                    <p>Kind:{props.league.kind}</p>
                </div>
            </div>
        )
    }

    //Commish view. Max at 16?  why not?
    return (
        <div>
            <h1>League Settings</h1>
            <form onSubmit={submit}>
                <input name="leagueName" type="text" value={leagueName} onChange={handleChange}></input>
                <input name="maxOwner" type="number" max="16" value={maxOwner} onChange={handleChange}></input>
                <select name="kind" id="league_kind" onChange={handleChange} value={kind}>
                    <option value="TRAD">Traditional</option>
                    <option value="TP">Total Points</option>
                    <option value="ALLPLAY">All Play</option>
                    <option value="PIRATE">Pirate</option>
                    <option value="GUILLOTINE">Guillotine</option>
                </select>
                <button type="submit">Save Settings</button>
            </form>
        </div>
    )
}

//Considering the depth we get into for our settings, we're going to need a component for each of our big settings
//categories.  Draft settings is pretty simple.  We'll present a "kind" selection, which will toggle between two set
//defaults, and if the user selects custom they can have access to all the options in the table.
function DraftSettings(props) {
    const [settings, setSettings] = useState({ "draft": {}, "positional": {} })
    const [loading, setLoading] = useState(true)
    const [dForm, setDForm] = useState([])
    const [pForm, setPForm] = useState([])
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)

    //We should Identify which keys need which type of inputs.
    const selects = ['Kind', 'DraftOrder']
    const times = ['Time']
    const numbers = ['Rounds', 'DraftClock']
    //And we need to identify our keys for draft and positional.
    const draftKeys = ['Kind', 'DraftOrder', 'Time', "DraftClock", "Rounds"]


    useEffect(() => {
        let url = "/league/settings/getdraft/" + 1 //props.league
        fetch(url, { method: "GET" })
            .then(response => response.json())
            .then(data => {
                setSettings(data)
                setLoading(false)
            })
            .catch(error => console.error(error))
    }, [])

    useEffect(() => {
        formDraft()
        formPos()
    }, [settings])


    function handleChange(e) {
        e.preventDefault()
        //This should work because settings contains no references.
        let newSettings = Object.assign({}, settings)
        let key
        //Why are you like this Javascript?
        if (draftKeys.findIndex(s => s === e.target.name) != -1) {
            key = "draft"
        } else {
            key = "positional"
        }

        if (e.target.name.startsWith("Time")) {
            let current = settings[key].Time.split("T")
            if (e.target.name == "Time_date") {
                newSettings[key].Time = e.target.value + "T" + current[1]
            } else {
                newSettings[key].Time = current[0] + "T" + e.target.value
            }


        } else {
            newSettings[key][e.target.name] = e.target.value
        }

        setSettings(newSettings)
    }

    function findInputType(key) {
        if (selects.includes(key)) { return "select" }
        if (times.includes(key)) { return "time" }
        if (numbers.includes(key)) { return "number" }
        return "text"
    }

    function formPos() {
        var protoForm = []
        Object.entries(settings.positional).forEach(([key, value]) => {
            if (key == "Kind") {
                protoForm.push(<label htmlFor={"pos_" + key}>{key}</label>)
                protoForm.push(
                    <select name={key} id={"pos_" + key} value={value} onChange={handleChange}>
                        <option>Traditional</option>
                        <option>Individual Defensive Players</option>
                        <option>Custom</option>
                    </select>
                )
            } else if (key == "ID") {

            } else {
                protoForm.push(<label htmlFor={"pos_" + key}>{key}</label>)
                protoForm.push(<input type="number" name={key} id={"pos_" + key} value={value} max={12} onChange={handleChange} />)
            }
        })
        setPForm(protoForm)
    }

    function formDraft() {
        let protoForm = []
        Object.entries(settings.draft).forEach(([key, value]) => {
            switch (findInputType(key)) {
                case "select":
                    let selectMeat = key == "Kind" ?
                        [<option value="TRAD">Traditional</option>, <option value="AUCTION">Custom</option>] :
                        [<option value="SNAKE">Snake</option>, <option value="STRAIGHT">Straight</option>, <option value="CURSED">Cursed</option>]
                    protoForm.push(<label htmlFor={"pos_" + key}>{key}</label>)
                    protoForm.push(<select name={key} id={"draft_" + key} value={value} onChange={handleChange}>
                        {selectMeat.map(o => o)}
                    </select>)
                    break;
                case "number":
                    protoForm.push(<label htmlFor={"pos_" + key}>{key}</label>)
                    protoForm.push(
                        <div>
                            <label htmlFor={"draft_" + key}>{key}</label>
                            <input type="number" name={key} id={"draft_" + key} value={value} onChange={handleChange} />
                        </div>)
                        
                    break;
                // case "checkbox":
                //     protoForm.push(<label htmlFor={"pos_" + key}>{key}</label>)    
                // protoForm.push(
                //         <div>
                //             <input type="checkbox" name={key} id={"draft_" + key} checked={value} onChange={handleCheckbox} />
                //             <label htmlFor={key}>{key}</label>
                //         </div>
                //     )
                //     break;
                case "time":
                    let today = new Date(Date.now()).toISOString().split("T")
                    let split = value.split("T")
                    protoForm.push(<label htmlFor={"pos_" + key}>{key}</label>)
                    protoForm.push(
                        <div>
                            <label htmlFor={key + "_date"}>Draft Start</label>
                            <input type="date" name={key + "_date"} id={"draft_" + key + "_date"} min={today[0]} value={split[0]} onChange={handleChange} />
                            <input type="time" name={key + "_time"} id={"draft_" + key + "_time"} value={split[1].replace("Z", "")} onChange={handleChange} />
                        </div>)
                        
                    break;
                default:
                    key == "ID" ? "" :
                    protoForm.push(<label htmlFor={"pos_" + key}>{key}</label>)
                    protoForm.push(<input type="text" name={key} id={"draft_" + key} value={value} onChange={handleChange} />)
                        
            }
        })
        setDForm(protoForm)
    }

    if (loading) {
        return (
            <div>
                loading...
            </div>
        )
    }
    if (User.id !== props.commissioner.id) {
        return (
            <div>
                <h1>Draft Settings</h1>
                {Object.entries(settings.draft).forEach(([key, value]) => {
                    key == "id" ? "" :
                        <div>
                            <h6>{key}:</h6><p>{value}</p>
                        </div>
                })}
                <h1>Positional Settings</h1>
                {Object.entries(settings.positional).forEach(([key, value]) => {
                    key == "id" ? "" :
                        <div>
                            <h6>{key}:</h6><p>{value}</p>
                        </div>
                })}
            </div>
        )
    }

    return (
        <div>
            <h1>Draft Settings</h1>
            <form name="draft">
                {dForm.map(s => s)}
                <h2>Positional Settings</h2>
                {pForm.map(s => s)}
                <input type="submit">Change Draft settings</input>
            </form>
        </div>
    )
}

//Finally, Scoring settings 
function ScoringSettings(props) {
    const [settings, setSettings] = useState({})
    const [form, setForm] = useState([])
    const [loading, setLoading] = useState(true)
    const User = useContext(UserContext)

    useEffect(() => {
        let url = "/league/settings/getscor/" + 1
        fetch(url, { method: "GET" })
            .then(response => response.json())
            .then(data => setSettings(data))
            .catch(error => console.error(error))
        setLoading(false)
    }, [])

    useEffect(() => {
        formBuilder()
    }, [settings])

    function handleChange(e) {
        e.preventDefault()
        let newSettings = Object.assign({}, settings)
        if (e.target.name)
        newSettings[e.target.name]
    }


    function formBuilder() {
        var protoForm = []
        Object.entries(settings).forEach(([key, value]) => {
            Object.entries(value).forEach(([key2, value2]) => {
                protoForm.push(<label htmlFor={key2}>{key2}</label>)
                protoForm.push(<input type="number" name={key2} id={"score_" + key2} value={value2} max={12} />)
            })
        })
        setForm(protoForm)
    }


    if (loading) {
        return (
            <div>
                loading...
            </div>
        )
    }
    if (User.id !== props.commissioner.id) {
        return (
            <div>
                <h1>Draft Settings</h1>
                {Object.entries(settings).forEach(([key, value]) => {
                    key == "id" ? "" :
                        <div>
                            <h6>{key}:</h6><p>{value}</p>
                        </div>
                })}
            </div>
        )
    }

    return(
        <div>
            <h1>Scoring Settings</h1>
            <form>
                {form.map(s => s)}
            </form>
        </div>
    )
}