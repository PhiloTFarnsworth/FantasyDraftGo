const { useState, useEffect, useRef, useContext } = React;

function Draft(props) {
    const draftSocket = useRef(null)

        //This useEffect populates some of our states once on load
        useEffect(() => {
            //So we're going to use a websocket to update the draft as it progresses.
            draftSocket.current = new WebSocket(
                'ws://'
                + window.location.host
                + '/ws/draft/'
                + props.leagueID
                + ''
            );
        }, [])

    //This useEffect mostly controls our draft socket
    useEffect(() => {
        if (draftSocket !== null) {
            //We'll toggle status onopen and onclose of a draft socket, on receipt of these
            //sends we'll update the model and return the active teams in the draft
            draftSocket.current.onclose = (e) => {
                console.log('Websocket closed unexpectedly')
                //draftSocket.send(JSON.stringify({'type': 'status', 'team': props.teamControl, 'league': props.leagueID}))
            }
            draftSocket.current.onopen = (e) => {
                //on open we need to update status of player controlled teams.
                //draftSocket.current.send(JSON.stringify({'type': 'status', 'team': props.teamControl, 'league': props.leagueID}))
            }
            draftSocket.current.onmessage = (e) => {
                //const data = JSON.parse(e.data)
                var item = document.createElement("div")
                item.innerHTML = e.data
                var chat = document.getElementById("fakechat")
                chat.appendChild(item)
                }
            }
        }, [draftSocket])

    function submit(e) {
        e.preventDefault()
        draftSocket.current.send(msg.value)
    }

    return(
        <div>
        <div id="fakechat">

        </div>
        <form onSubmit={submit}>
            <input id="msg" type="text" />
            <button type="submit">chat</button>
        </form>
        </div>
    )
}