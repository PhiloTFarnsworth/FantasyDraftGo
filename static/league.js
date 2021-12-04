const { useState, useEffect } = React;

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
    const [leagueProps, setLeagueProps] = useState({"id": 0, "name": "", "state": "", "ownerCount": 0})
    const [commissioner, setCommissioner] = useState({"id": 0, "name": "", "email": ""})
    const [teams, setTeams] = useState([])
    const [invites, setInvites] = useState([])

    //Init useEffect.  Since we load from a league ID, we want to populate our league props to determine user's
    //permissions and what state the league is in.
    useEffect(() => {
        let url = "/league/home/" + props.ID
        fetch(url, {method: "GET"})
        .then(response => response.json())
        .then(data => {
            console.log(data)
            setCommissioner(data.league.Commissioner)
            setLeagueProps({"id": data.league.ID, "name": data.league.Name, "state": data.league.State, "ownerCount": data.league.OwnerCount})
            if (data.teams != null) {
                setTeams(data.teams)
            }
            if (data.invites != null) {
                setInvites(data.invites)
            }
        })
        .catch(error => console.error(error))
    }, [])


    function closeLeague() {
        props.openLeague(0)
    }


    //Since our league state is going to have a fair bit of control over how we render league home, I think we build
    //Our component based on that.  So many notes already and I have a feeling this'll be refactored greatly.

    switch (leagueProps.state) {
        case "INIT":
            return(
                <div>
                    <button className='btn-close btn-close' onClick={closeLeague}></button>
                    Welcome!
                    {teams.map(team => <TeamBox team={team}/>)}
                    {invites.map(invite => <p>{invite.name}</p>)}
                    <InviteBox invite={null} commissioner={commissioner} user={props.user} league={leagueProps.id} />
                </div>        
            )
        default:
            return <div>loading...</div>
    }
}

//Team Box should be a generic view of all top end team information.  
function TeamBox(props) {
    return(
        <div id={props.team.id + "_team"}>
            {props.team.Name} - {props.team.Manager.name} ({props.team.Manager.email})
        </div>
    )
}

function InviteBox(props) {
    const [invitee, setInvitee] = useState("")
    const [completeInvite, setCompleteInvite] = useState(null)

    function handleChange(e) {
        e.preventDefault()
        setInvitee(e.target.value)
    }
    const invite = (e) => {
        e.preventDefault()
        //Do a little verification on the front end.
        if (props.user.id != props.commissioner.id) {
            return null
        }
        let csrftoken = document.getElementById('CSRFToken').textContent
        fetch("/invite", {
            method: "POST",
            headers: {
                'X-CSRF-TOKEN': csrftoken,
                'Content-Type': 'Application/json'    
            },
            body: JSON.stringify({"user": props.user, "invitee": invitee, "league": props.league})
        })
        .then(response=>response.json())
        .then(data => setCompleteInvite(data))
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
                    <input type='email' placeholder="email" onChange={handleChange}></input>
                    <button type='submit'>Invite!</button>
                </form>
            </div>)
    } else {
        return (
            <div>
                {completeInvite.name - (completeInvite.manager)}
            </div>
        )
    }   
}