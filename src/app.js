'use strict'

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import Notify, { UserContext, NotifyContext } from './scripts/util.js'
import LoginController from './scripts/logincontrol.js'
import Header from './scripts/header.js'
import Lobby from './scripts/lobby.js'
const anonymousUser = { ID: 0, name: '', email: '' }

// It is perhaps most helpful to think of this app as coming in layers.  App takes care of two very basic needs we have.  First, it houses
// our authentication, as most if not all parts of the final product will require a registered user.  Second, we have a very basic notification
// system, which will communicate to the user any errors on our end.  Once a user registers their identity, they are passed to the second
// layer, Lobby.

function App () {
  // Since a nil number gets interpreted as a zero when we pass it in, and our sql indexes start at 1, we can use zero to stand in for
  // an anonymous user.
  const [user, setUser] = useState(anonymousUser)
  const [notification, SetNotification] = useState({ message: null, code: null })
  const [loading, setLoading] = useState(true)

  function handleUserChange (userObj) {
    setUser(userObj)
  }

  function notify (message, code) {
    SetNotification({ message: message, code: code })
  }

  function clearNote () {
    SetNotification({ message: null, code: null })
  }

  function loaded () {
    setLoading(false)
  }

  useEffect(() => {
    const userObj = {
      ID: parseInt(document.getElementById('userID').textContent),
      name: document.getElementById('username').textContent,
      email: document.getElementById('userEmail').textContent
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
            <div className="container p-2" style={{ minHeight: '100vh' }}>
              <Header />
              <Notify note={notification} onClick={clearNote} />
              {user.ID === 0 // Guest view or lobby
                ? <UnregisteredLobby handleUserChange={handleUserChange} />
                : <Lobby />}
            </div>
          </NotifyContext.Provider>
        </UserContext.Provider>
      </React.StrictMode>
    )
  }
}

// Explains FantasyDraft and houses LoginController
function UnregisteredLobby (props) {
  return (
    <div className='row m-2 p-2 bg-white' style={{ minHeight: '80vh' }} >
      <h1 className='display-4 text-center'>FantasyDraft</h1>
      <h2 className='display-5 text-center'>Fantasy Football Filtered for Fluff</h2>
      <div className='col'>
        <p><strong>FantasyDraft</strong> allows you to</p>
        <ul>
          <li>Create Fantasy Football Leagues</li>
          <li>Invite your friends to compete across an NFL season</li>
          <li>Build a fantasy football team featuring NFL players through a live draft</li>
        </ul>
        <p>Create an account and start your league today!</p>
      </div>
      <div className='col'>
        <LoginController onRegister={props.handleUserChange} />
      </div>
    </div>
  )
}

ReactDOM.render(
    <App />,
    document.getElementById('root')
)
