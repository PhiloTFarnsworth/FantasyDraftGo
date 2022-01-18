'use strict';
const { useState, useEffect } = React;

//Draft board is going to be the general information box.  On entry, players will see a default that shows the draft order and as the draft progresses, the
//draft board home screen will track the most recent round of picks.  Possibly with some sort of table showing best available players or something in that vein.
//The draft board will also have different views based on context.  Selected players will bring up their name, pertinent stats and a draft button. 
//Selected teams will show their roster so far.  Both views will have a back button to restore the base draft board.
function DraftBoard(props) {
    if (props.currentPick >= ROUNDS * props.teams.length) {
        //Draft over, display teams.
        let teamSummaries = []
        for (let i = 0; i < props.teams.length; i++) {
            let picks = props.history.filter(pick => pick.Team === props.teams[i].ID)
            roster = picks.map(pick => pick.Player)
            teamSummaries.push(<TeamSummary 
                                team={props.teams[i]} 
                                roster={roster} 
                                currentPick={props.currentPick} 
                                max={ROUNDS*props.teams.length}/>)
        }
        return teamSummaries
    } else {
        let drafting = props.history[props.currentPick] 
        if (props.focus.context === 'player') {
            let index = props.players.findIndex(player => player.ID === props.focus.ID)
            return <PBio player={props.players[index]} 
                pk={props.focus.ID} 
                selectPlayer={props.selectPlayer} 
                drafting={drafting.Team}  
                shiftFocus={props.shiftFocus}/>
        }
        if (props.focus === 'team') {
            let picks = props.history.filter(pick => pick.Team === props.focus.ID)
            roster = picks.map(pick => pick.Player)
            let index = props.teams.findIndex(team => team.ID === pick.Team)
            return <TeamSummary 
                    team={props.teams[index]} 
                    roster={roster} 
                    shiftFocus={props.shiftFocus} 
                    currentPick={props.currentPick} 
                    max={ROUNDS*props.teams.length}/>
        }
        
        return <DraftSummary 
                history={props.history} 
                currentPick={props.currentPick} 
                teams={props.teams} 
                shiftFocus={props.shiftFocus}/>
        
    }
}

//Draft summary is an overview of the draft.
function DraftSummary(props) {
    //Make it navigable.
    const [page, setPage] = useState(0)
    const [summary, setSummary] = useState([])

    //For spacing, we're going with 10 table heights for all draft board views, so we'll display labels, 8 picks, then navigation for Draft Summary
    const pageLength = 8
    const pageMax = Math.floor((ROUNDS*props.teams.length-1)/pageLength)

    //Set page on load
    useEffect(()=>{
        setPage(Math.floor(props.currentPick/pageLength))
    }, [])

    //Change summary on page change
    useEffect(()=>{
        let end = page*pageLength+8 >= ROUNDS*props.teams.length ? ROUNDS*props.teams.length : page*pageLength+8
        setSummary(props.history.slice(page*pageLength, end))
    }, [page])

    const navigate = (e) => {
        e.preventDefault()
        e.target.id === 'previous' ? setPage(page-1) : setPage(page+1) 
    }

    const teamFocus = (e) => {
        e.preventDefault()
        props.shiftFocus({'context': 'team', 'ID': e.currentTarget.attributes.team.value})
    }

    return(
            <table className='table table-responsive table-sm text-center'>
                <thead>
                <tr>
                    <th>Team</th><th>Pick</th><th>Selection</th>
                </tr>
                </thead>
                <tbody>
                    {summary.map((row) =>
                        //TODO: Styling for active pick
                        <tr key={'draft_row_' + row.Slot}>
                            <td><div className='d-grid gap-2 text-nowrap overflow-hidden'>
                                <button 
                                className='btn btn-outline-success btn-sm' 
                                team={row.team} 
                                onClick={teamFocus}>{props.teams.filter(team => row.ID === team.ID).Name}</button>
                            </div></td>
                            <td>{row.Slot}</td>
                            <td>{row.Player === '' ? 'tbd' : props.players.filter(player => player.ID === row.Player).Name}</td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td className='col-5'>
                        <div className='d-grid gap-2'>
                        {page === 0 ?
                        <button className='btn btn-warning btn-sm' id='previous' onClick={navigate} disabled>Previous</button> :
                        <button className='btn btn-warning btn-sm' id='previous' onClick={navigate}>Previous</button>}
                        </div>
                        </td>
                        <td className='col-2'>
                        <div className='text-center'>
                        {page + 1} of {pageMax + 1}
                        </div>
                        </td>
                        <td className='col-5'>
                        <div className='d-grid gap-2'>
                        {page === pageMax ?
                        <button id='next' className='btn btn-warning btn-sm' onClick={navigate} disabled>Next</button> :
                        <button className='btn btn-warning btn-sm' id='next' onClick={navigate}>Next</button>}
                        </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
    )
}

function PBio(props) {
    
    const resetFocus = (e) => {
        e.preventDefault()
        props.shiftFocus({'context': 'summary'})
    }

    const handleSelection = (e) => {
        e.preventDefault()
        props.selectPlayer(e.target.id)
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
        //'rushing_yards_per_attempt_YPA',
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

    let url = 'https://www.pro-football-reference.com/players/' + props.player.PfbrName[0] + '/' + props.player.PfbrName + '.htm'
    let statList = []
    Object.keys(props.player).map((statName, index) => {
        switch (props.player.Position) {
            case 'QB':
                if (QB.includes(statName)) {
                    statList.push(index)
                }
                break
            case 'RB':
                if (RB.includes(statName)) {
                    statList.push(index)
                }
                break
            default:
                if (WR.includes(statName)) {
                    statList.push(index)
                }
                break
        }
    })
    

    return(
        <div>
            <table className='table table-responsive table-sm'>
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
                <tbody className='text-center'> {Object.values(props.player).map((stat, index) => statList.includes(index) ?
                        <tr key={index + stat}>
                            <th>{Object.keys(props.player)[index]}</th><td>{stat}</td><td colSpan='2'></td>
                        </tr>
                        :''
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan='4'><a href={url}>See their whole career at Pro-Football-Reference.com</a></td>
                    </tr>
                    <tr>
                        <td colSpan='4'>
                        <div className='d-grid gap-2'>
                        {props.teamControl === props.drafting ? 
                        <button className='btn btn-success btn-sm' id={props.pk} onClick={handleSelection}>Draft</button> : 
                        <button className='btn btn-light btn-sm' id={props.pk} onClick={handleSelection} disabled>Draft</button>}
                        </div>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}


//Team Summary is a view that shows a teams selected players, as well as point totals for each position.
function TeamSummary(props) {
    const resetFocus = (e) => {
        e.preventDefault()
        props.shiftFocus({'context': 'summary'})
    }

    let qbs = []
    let rbs = []
    let wrs = []
    let tes = []
    
    let qbPoints = 0
    let rbPoints = 0
    let wrPoints = 0
    let tePoints = 0
    
    for (let i = 0; i < props.roster.length; i++) {
        if (props.roster[i] !== 'tbd') {
            switch (props.roster[i].fields.position_POS) {
                case 'QB': 
                    qbs.push(props.roster[i])
                    qbPoints += props.roster[i].fields.fantasy_points_FP
                    break
                case 'RB': 
                    rbs.push(props.roster[i])
                    rbPoints += props.roster[i].fields.fantasy_points_FP
                    break
                case 'WR': 
                    wrs.push(props.roster[i])
                    wrPoints += props.roster[i].fields.fantasy_points_FP
                    break
                case 'TE': 
                    tes.push(props.roster[i])
                    tePoints += props.roster[i].fields.fantasy_points_FP
                    break
            }
        }
    }
    
    // let max = Math.max(qbs.length, rbs.length, wrs.length, tes.length)

        return(
            <table className='table table-responsive table-sm text-center'>
                <thead>
                {props.currentPick < props.max ?
                <tr><td colSpan='5'><div className='d-grid gap-2'>
                    <button onClick={resetFocus} className='btn btn-danger btn-sm'>Draft Summary</button>
                </div></td></tr>
                : ''
                }
                <tr><th colSpan='5'>{props.name}</th></tr>
                <tr><td colSpan='5'>Manager: {props.manager}</td></tr>
                <tr>
                    <td></td><th>QB</th><th>RB</th><th>WR</th><th>TE</th>
                </tr>
                </thead>
                <tbody>
                {/* For spacing, we'll list the first 5 players taken at each position.  is sufficient for show, though future iterations
                we'll need a more robust solution */}
                {[...Array(5)].map((_,i) => 
                    <tr key={'roster_row' + (i + 1).toString()}>
                        <th>{i + 1}:</th>
                        <td key={'QB' + (i + 1).toString()}>{i < qbs.length ? qbs[i].fields.name : ''}</td>
                        <td key={'RB' + (i + 1).toString()}>{i < rbs.length ? rbs[i].fields.name : ''}</td>
                        <td key={'WR' + (i + 1).toString()}>{i < wrs.length ? wrs[i].fields.name : ''}</td>
                        <td key={'TE' + (i + 1).toString()}>{i < tes.length ? tes[i].fields.name : ''}</td>
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
