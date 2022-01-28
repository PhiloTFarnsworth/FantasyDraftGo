const { useState, useEffect, useContext } = React;
//The ultimate layer is the League layer, where a user has specified a specific league
//and is returned a portal for that league.  From here we can access all the managerial options
//a user has access to as a team owner, as well as any information about the league.

//As it stands, we have 4 states we should concern ourselves with in this component, plus
//optional rendering for each state depending on whether the user is a commissioner of a league or not.

//INIT - This should display a list of users in the league, as well as potential invitees.  Commissioner 
//Should be able to input a name or email and invite the user.
//PREDRAFT - All teams have joined a league and the commissioner has locked entry by new users.  This should
//Display information about the upcoming draft, and in future iterations some sort of draft tools.  Commissioner
//needs tools to set draft order, set a date and time for the draft to officially commence and change options.
//These settings should be visible to all users.  When draft is active, direct users to draft.
//DRAFT - This should lead straight to the draft component
//INPROGRESS - This should be the most commonly seen view.  display standings, a little smack talk messenger,
//and links to teams, free agents and all that good stuff.  
//COMPLETE - This should display end of the year awards and the like.  links should lead to non-interactive versions
//of links from the inprogress screen.

//After some consultation with myself, I think a hierarchy is emerging.  All leagues need a header to identify
//the context as well as a league nav, then we will use our league states to identify a default component
//to display as the main content on the page. 
function LeagueHome(props) {
    const [leagueProps, setLeagueProps] = useState({ ID: 0, name: "", state: "", maxOwner: 0 })
    const [commissioner, setCommissioner] = useState({ ID: 0, name: "", email: "" })
    const [teams, setTeams] = useState([])
    const [invites, setInvites] = useState([])
    const [openSpots, setOpenSpots] = useState(0)
    const [loading, setLoading] = useState(true)
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
                setLeagueProps({ ID: data.league.ID, name: data.league.Name, state: data.league.State, maxOwner: data.league.MaxOwner })
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
        let count = invites.length + teams.length
        if (count > leagueProps.maxOwner) {
            setOpenSpots(0)
            if (commissioner.ID == User.ID) {
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
            body: JSON.stringify({ league: leagueProps.ID })
        })
            .then(response => response.json())
            .then(data => {
                if (data.ok == false) {
                    Notify(data.error, 0)
                } else {
                    let newProps = {
                        ID: leagueProps.ID,
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

    function startDraft(e) {
        e.preventDefault()
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/startdraft", {
            method: "POST",
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
                    let newProps = {
                        ID: leagueProps.ID,
                        name: leagueProps.name,
                        state: data.state,
                        maxOwner: leagueProps.maxOwner
                    }
                    setLeagueProps(newProps)
                    Notify("Draft has begun!", 1)
                }
            })
            .catch(error => console.error(error))
    }

    if (loading) {
        return <div>loading...</div>
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
                    {[...Array(openSpots)].map((x, i) => <InviteBox key={"anon_invite_" + i} invite={null} commissioner={commissioner} league={leagueProps.ID} />)}
                    {openSpots == 0 ? <button onClick={lockLeague}>Lock League</button> : ""}
                    <LeagueSettings league={leagueProps} commissioner={commissioner} setLeague={setLeagueProps} />
                </div>
            )
        case "PREDRAFT":
            return (
                <div>
                    <h1>Review Settings</h1>
                    <p>When satisfied, click start draft button to begin draft</p>
                    <button onClick={startDraft}>Start Draft</button>
                    <DraftSettings league={leagueProps.ID} commissioner={commissioner} />
                    <DraftOrder league={leagueProps} teams={teams}/>
                </div>
            )
        case "DRAFT":
            return <Draft league={leagueProps} teams={teams} />
        default:
            return null
            
    }
}

//Team Box should be a generic view of all top end team information.  
function TeamBox(props) {
    return (
        <div id={props.team.ID + "_team"}>
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
        if (User.ID != props.commissioner.ID) {
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
    if (User.ID !== props.commissioner.ID) {
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
                <input name="maxOwner" type="number" max="16" min="2" value={maxOwner} onChange={handleChange}></input>
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
    const [settings, setSettings] = useState({ "draft": {}, "positional": {}, "scoring": {} })
    const [loading, setLoading] = useState(true)
    const [dForm, setDForm] = useState([])
    const [pForm, setPForm] = useState([])
    const [sForm, setSForm] = useState([])
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)

    //We should Identify which keys need which type of inputs.
    const selects = ['Kind', 'DraftOrder']
    const times = ['Time']
    const numbers = ['Rounds', 'DraftClock']
    //And we need to identify our keys for draft and positional.


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
        formScore()
    }, [settings])


    function handleChange(e) {
        e.preventDefault()
        //This should work because settings contains no references.
        let newSettings = Object.assign({}, settings)
        let key = e.target.id.split("_")


        if (e.target.name.startsWith("Time")) {
            let current = settings[key[0]].Time.split("T")
            if (e.target.name == "Time_date") {
                newSettings[key[0]].Time = e.target.value + "T" + current[1]
            } else {
                newSettings[key[0]].Time = current[0] + "T" + e.target.value
            }
        } else {
            //Okay, this should work, but only because our input types limit input
            //and we have no user defined strings that can break this.
            if (key.length > 2) {
                //Scoring settings should be floats with hundreths level precision
                newSettings[key[0]][key[1]][e.target.name] = isNaN(parseFloat(e.target.value)) ? e.target.value : parseFloat(e.target.value)
            } else {
                //positional inputs, as well as rounds and draft clock
                newSettings[key[0]][e.target.name] = isNaN(parseInt(e.target.value)) ? e.target.value : parseInt(e.target.value)
            }
        }




        setSettings(newSettings)
    }

    function submit(e) {
        e.preventDefault()
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/league/settings/setdraft/" + props.league, {
            method: "POST",
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/json'
            },
            body: JSON.stringify(settings)
        })
            .then(response => response.json())
            .then(data => {
                if (data.ok != false) {
                    Notify("Draft Settings Saved", 1)
                } else {
                    Notify("Save failed due to: " + data.error, 0)
                }
            })
            .catch(error => console.error(error))
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
                protoForm.push(<label htmlFor={"positional_" + key}>{key}</label>)
                protoForm.push(
                    <select name={key} id={"positional_" + key} value={value} onChange={handleChange}>
                        <option>Traditional</option>
                        <option>Individual Defensive Players</option>
                        <option>Custom</option>
                    </select>
                )
            } else if (key == "ID") {

            } else {
                protoForm.push(<label htmlFor={"positional_" + key}>{key}</label>)
                protoForm.push(<input type="number" name={key} id={"positional_" + key} value={value} max={12} step={1} onChange={handleChange} />)
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
                    protoForm.push(<label htmlFor={"draft_" + key}>{key}</label>)
                    protoForm.push(<select name={key} id={"draft_" + key} value={value} onChange={handleChange}>
                        {selectMeat.map(o => o)}
                    </select>)
                    break;
                case "number":
                    protoForm.push(<label htmlFor={"draft_" + key}>{key}</label>)
                    protoForm.push(
                        <div>
                            <label htmlFor={"draft_" + key}>{key}</label>
                            <input type="number" name={key} id={"draft_" + key} value={value} onChange={handleChange} />
                        </div>)

                    break;
                case "time":
                    let today = new Date(Date.now()).toISOString().split("T")
                    let split = value.split("T")
                    protoForm.push(<label htmlFor={"draft_" + key}>{key}</label>)
                    protoForm.push(
                        <div>
                            <label htmlFor={key + "_date"}>Draft Start</label>
                            <input type="date" name={key + "_date"} id={"draft_" + key + "_date"} min={today[0]} value={split[0]} onChange={handleChange} />
                            <input type="time" name={key + "_time"} id={"draft_" + key + "_time"} value={split[1].replace("Z", "")} onChange={handleChange} />
                        </div>)

                    break;
                default:
                    key == "ID" ? "" :
                        protoForm.push(<label htmlFor={"draft_" + key}>{key}</label>)
                    key == "ID" ? "" :
                        protoForm.push(<input type="text" name={key} id={"draft_" + key} value={value} onChange={handleChange} />)
            }
        })
        setDForm(protoForm)
    }

    function formScore() {
        var protoForm = []
        Object.entries(settings.scoring).forEach(([key, value]) => {
            protoForm.push(<h3>{key}</h3>)
            Object.entries(value).forEach(([key2, value2]) => {
                key2 == "ID" ? "" :
                    protoForm.push(<label htmlFor={"scoring_" + key + "_" + key2}>{key2}</label>)
                key2 == "ID" ? "" :
                    protoForm.push(<input type="number" name={key2} id={"scoring_" + key + "_" + key2} value={value2} max={12} step={0.01} onChange={handleChange} />)
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
    if (User.ID !== props.commissioner.ID) {
        return (
            <div>
                <h1>Draft Settings</h1>
                {Object.entries(settings.draft).forEach(([key, value]) => {
                    key == "ID" ? "" :
                        <div>
                            <h6>{key}:</h6><p>{value}</p>
                        </div>
                })}
                <h1>Positional Settings</h1>
                {Object.entries(settings.positional).forEach(([key, value]) => {
                    key == "ID" ? "" :
                        <div>
                            <h6>{key}:</h6><p>{value}</p>
                        </div>
                })}
                <h1>Scoring Settings</h1>
                {Object.entries(settings.scoring).forEach(([key, value]) => {
                    Object.entries(value).forEach(([key2, value2]) => {
                        key2 == "ID" ? "" :
                            <div>
                                <h6>{key2}:</h6><p>{value2}</p>
                            </div>
                    })
                })
                }
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
                <input type="submit" value="Change Draft settings" />
            </form>
        </div>
    )
}

//We'll allow commissioners to set their own league draft orders, and otherwise we'll create
//a random ordering.  We should probably create order on league lock, display and allow editing
//during the predraft portion.
function DraftOrder(props) {
    const [order, setOrder] = useState([])
    const [unassigned, setUnassigned] = useState([])
    const [loading, setLoading] = useState(true)
    const User = useContext(UserContext)
    const Notify = useContext(NotifyContext)
    
    useEffect(() => {
        fetch("/league/order/" + props.league.ID, { method: "GET" })
        .then(response => response.json())
        .then(data => {
            //So if we return an empty array, draft order has never been set.
            if (data !== null) {
                //otherwise, we map out the data to a draft order state.
                let newOrder = []
                data.map(o => {
                    //We return order as a slot and a team id, so we should use the team ID
                    //to pull the team information.
                    for (let i = 0; i < props.teams.length; i++) {
                        if (props.teams[i].ID === o.ID) {
                            newOrder.push(props.teams[i])
                            break;
                        }
                    }
                })
                setOrder(newOrder)
            } else {
                let newUnassigned = []
                let blankOrder = []
                for (let i = 0; i < props.teams.length; i++) {
                    newUnassigned.push(props.teams[i])
                    blankOrder.push({ID: -1})
                }
                setUnassigned(newUnassigned)
                setOrder(blankOrder)
            }
            setLoading(false)
        })
        .catch(error => console.log(error))  
    }, [])

    //We'll grab the length of props.teams, then randomly toss out numbers until we've assigned each team.
    function generateRandomOrder(e) {
        e.preventDefault()
        let min = 1
        let max = props.teams.length
        let slots = []
        let randOrder = []
        //There's likely a better way, but we'll assign positions to an array.
        for (let i = 0; i < max; i++) {
            slots.push(i)
        }
        //Then, we'll pull indexes at random, splicing them from the slots array into the 'newOrder' array,
        //reducing the max by 1 until we have all numbers assigned.  
        while (min <= max) {
            //See math.random in the mdn documentation
            let rand = Math.floor(Math.random() * ((max+1)-min))
            let s = slots.splice(rand, 1)
            randOrder.push(s)
            max = slots.length
        }
        //Finally, with all draft slots distributed, set our new order
        let newOrder = [...order]
        for (let i = 0; i < newOrder.length; i++) {
            newOrder[i] = props.teams[randOrder[i]]
        }
        //We set our order to the generated order
        setOrder(newOrder)
        //Finally, we take our new order and make it agree with the team/spot layout we have in
        //the sql.
        let serverOrder = []
        for (let i=0; i< newOrder.length; i++) {
            serverOrder.push({Team: newOrder[i].ID, Slot: i + 1})
        }
        //Then submit it to the server
        setOrderServerside(serverOrder)
    }

    function setOrderServerside(newOrder) {
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/league/setorder/" + props.league.ID, {
            method: "POST", 
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/json'
            },
            body: JSON.stringify(newOrder)
        })
        .then(response => response.json())
        .then(data => {
            if (data.ok != false) {
                Notify("Draft Order Set", 1)
            } else {
                Notify("Draft Order failure: " + data.error, 0)
            }})
        .catch(error => console.log(error))
    }

    //What we do here is we remove the team from unassigned, lock the team in the slot and add it to our draft order
    //list.  
    function lockSlot(e) {
        e.preventDefault()
        //First, we grab the ID of the select that holds the users choice.  the integer after 'draft_order_lock_' contains
        //is shared with the select field draft_order_, so we can grab the users choice of team.  
        let chosenID = document.querySelector('#draft_order_' + e.target.id.replace("draft_order_lock_", "")).value
        let index
        let choice
        for (let i = 0; i < unassigned.length; i++) {
            if (chosenID == unassigned[i].ID) {
                index = i
                choice = unassigned[i]
            }
        }
        //Take the chosen team out of unassigned
        let newUnassigned = [...unassigned]
        newUnassigned.splice(index, 1)
        setUnassigned(newUnassigned)

        //Then we simply replace the placeholder {ID: -1} on the order array.
        let newOrder = [...order]
        newOrder[i] = choice
        setOrder(newOrder)
    }
    

    function isOrderSet() {
        if (order.length != teams.length) {
            return false
        }
        for (let i = 0; i < order.length; i++) {
            if (order[i].ID === -1) {
                return false
            }
        }
        return true
    }

    if (loading) {
        return <div>loading...</div>
    }

    //Far from ideal, but we'll have the user chose between generating a Random order, or assigning the slots
    //for each team.  Each unassigned slot will have the pick number followed by a select containing each team
    //not yet assigned to another slot.  When a user has assigned all teams (by locking their draft position),
    //the 'set order' submit button will become enabled, allowing the user to submit the order for the server.
    if (isOrderSet) {
        return(
            <div>
                <h1>Set draft order</h1>
                <button onClick={generateRandomOrder}>Generate Random Order</button>

                <div>--OR-- *this should collapse or smth*</div>
                <div>
                </div>
                <form onSubmit={setOrderServerside}>
                {props.teams.map((team, i) => {
                    if (unassigned.some(u => u.ID === team.ID)) {
                    <div>
                        <p> true</p>
                        <label for={"draft_order_" + i}>#{i+1} Pick</label>
                        <select id={"draft_order_" + i}>
                            {unassigned.map(t => <option value={t.ID}>{t.Name} - {t.Manager.Name}</option>)}
                        </select>
                        <button onClick={lockSlot} id={"draft_order_lock_" + i}>Lock Draft Position</button>
                    </div>
                    } else {
                        <div>
                            <p> #{i+1} Pick: {order[i].Name} - {order[i].Manager.name}</p>
                        </div>
                    }
                })}
                {unassigned.length > 0 
                ? <button type="submit" disabled>Set Order!</button>
                : <button type="submit">Set Order!</button>}
                
                </form>
            </div>
            
        )
    }

    return(
        <div>
            <ol>
                {order.map(o => <li>{o.Slot} - {o.team.name} Manager: {o.team.Manager.Name}</li>)}
            </ol>
        </div>
    )
}