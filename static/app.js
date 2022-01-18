'use strict'
const { useState, useEffect, useContext } = React;

//It is perhaps most helpful to think of this app as coming in layers.  App takes care of two very basic needs we have.  First, it houses
//our authentication, as most if not all parts of the final product will require a registered user.  Second, we have a very basic notification
//system, which will communicate to the user any errors on our end.  Once a user registers their identity, they are passed to the second 
//layer, Lobby.
function App() {
    //Since a nil number gets interpreted as a zero when we pass it in, and our sql indexes start at 1, we can use zero to stand in for
    //an anonymous user.  
    const [user, setUser] = useState(anonymousUser)
    const [notification, SetNotification] = useState({ message: null, code: null })
    const [loading, setLoading] = useState(true)

    function handleUserChange(userObj) {
        setUser(userObj)
    }

    function notify(message, code) {
        SetNotification({ message: message, code: code })
    }

    function clearNote() {
        SetNotification({ message: null, code: null })
    }

    function loaded() {
        setLoading(false)
    }

    useEffect(() => {
        const userObj = {
            'ID': parseInt(document.getElementById("userID").textContent),
            'name': document.getElementById("username").textContent,
            'email': document.getElementById("userEmail").textContent
        }
        setUser(userObj)
        loaded()
    }, [])

    if (loading) {
        return <div>Loading...</div>
    } else {
        return (
            <React.StrictMode>
            <UserContext.Provider value={user}>
                <NotifyContext.Provider value={notify}>
                    <div className="container">
                        <Header />
                        <Notify note={notification} onClick={clearNote} />
                        {user.ID === 0 ? //Guest view or lobby
                            <LoginController onRegister={handleUserChange} /> :
                            <Lobby />}
                    </div>
                </NotifyContext.Provider>
            </UserContext.Provider>
            </React.StrictMode>
        )
    }
}

function Notify(props) {
    if (props.note.message === null) {
        return null
    }

    let tag
    if (props.note.code === 0) {
        tag = "warning"
    } else {
        tag = "success"
    }

    return (
        <div className={"alert alert-" + tag} role="alert" >
            <div className='row'>
                <div className='col-6'><h6 className='display-6'>{props.note.message}</h6></div>
                <div className='col d-flex justify-content-end'><button onClick={props.onClick} className='btn btn-close'></button></div>
            </div>
        </div>
    )
}

ReactDOM.render(
    <App />,
    document.getElementById('root')
);