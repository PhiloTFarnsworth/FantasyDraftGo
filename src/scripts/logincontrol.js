'use strict'
import React, { useState, useContext } from 'react'
import { NotifyContext, csrftoken } from './util.js'

function LoginForm (props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const Notify = useContext(NotifyContext)

  const handleSubmit = (e) => {
    e.preventDefault()
    const userData = { username: username, password: password }
    const fetchData = async () => {
      const response = await fetch('/login', {
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify(userData),
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/JSON'
        }
      })
      const data = await response.json()

      if (response.ok) {
        const userObj = { ID: data.ID, name: data.name, email: data.email }
        props.onLogin(userObj)
      } else {
        Notify(data, 0)
      }
    }

    fetchData()
      .catch(error => console.error(error))
    // fetch('/login', {
    //   credentials: 'include',
    //   method: 'POST',
    //   body: JSON.stringify(userData),
    //   headers: {
    //     'X-CSRF-TOKEN': csrftoken,
    //     'Content-Type': 'Application/JSON'
    //   }
    // })
    //   .then(response => response.json())
    //   .then(data => {
    //     console.log('success:', data)
    //     // as long as data['ok'] is not a false value then we're good to go.  Use !== because I'm pretty sure null is false-y
    //     if (data.ok !== false) {
    //       const userObj = { ID: data.ID, name: data.name, email: data.email }
    //       props.onLogin(userObj)
    //     } else {
    //       Notify(data.error, 0)
    //       console.error(data.error)
    //     }
    //   })
    //   .catch(error => { console.error('fail:', error) })
  }

  const handleChange = (e) => {
    e.preventDefault()
    e.target.type === 'password' ? setPassword(e.target.value) : setUsername(e.target.value)
  }

  return (
        <form onSubmit={handleSubmit}>
            <div className='d-flex justify-content-end mb-2'>
                <button onClick={props.onDismiss} className='btn-close btn-close' aria-label="Close"></button>
            </div>
            <legend>Log in to FantasyDraft!</legend>
            <div className='mb-2'>
                <label htmlFor='logName' className='form-label'>Username</label>
                <input type='text' name='username' id='logName' className='form-control' value={username} onChange={handleChange} required></input>
            </div>
            <div className='mb-2'>
                <label htmlFor='logPass' className='form-label'>Password</label>
                <input type='password' name='password' id='logPass' className='form-control' value={password} onChange={handleChange} required></input>
            </div>
            <div className='d-grid gap-2 mb-2'>
                <button type='submit' className='btn btn-success'>Login</button>
            </div>
        </form>
  )
}

function RegisterForm (props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')

  const Notify = useContext(NotifyContext)

  const handleChange = (e) => {
    e.preventDefault()
    if (e.target.name === 'username') {
      setUsername(e.target.value)
    } else if (e.target.name === 'password') {
      setPassword(e.target.value)
    } else if (e.target.name === 'confirm') {
      setConfirm(e.target.value)
    } else {
      setEmail(e.target.value)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password !== confirm) {
      Notify('Password and Password confirmation do not match!', 0)
      return null
    }
    const fetchData = async () => {
      const userData = { username: username, password: password, email: email }
      const response = await fetch('/register', {
        method: 'POST',
        body: JSON.stringify(userData),
        headers: {
          'X-CSRF-TOKEN': csrftoken,
          'Content-Type': 'Application/json'
        }
      })
      const data = response.json()

      if (response.ok) {
        const userObj = { ID: data.ID, name: data.name, email: data.email }
        props.onRegister(userObj)
      } else {
        Notify(data, 0)
      }
    }
    fetchData()
      .catch(error => console.error(error))
    // fetch('/register', {
    //   method: 'POST',
    //   body: JSON.stringify(userData),
    //   headers: {
    //     'X-CSRF-TOKEN': csrftoken,
    //     'Content-Type': 'Application/json'
    //   }
    // })
    //   .then(response => response.json())
    //   .then(data => {
    //     if (data.ok !== false) {
    //       const userObj = { ID: data.ID, name: data.name, email: data.email }
    //       props.onRegister(userObj)
    //     } else {
    //       console.error(data.error)
    //       Notify(data.error, 0)
    //     }
    //   })
    //   .catch(error => { console.error('fail:', error) })
    // return false
  }

  return (
        <form onSubmit={handleSubmit}>
            <div className='d-flex justify-content-end'>
                <button onClick={props.onDismiss} className='btn-close btn-close' aria-label="Close"></button>
            </div>
            <legend>Register for FantasyDraft!</legend>
            <div className='mb-2'>
                <label htmlFor='registerName' className='form-label'>Username</label>
                <input type='text' name='username' className='form-control' id='registerName' onChange={handleChange} required></input>
            </div>
            <div className='mb-2'>
                <label htmlFor='registerEmail' className='form-label'>Email Address</label>
                <input type='email' name='email' className='form-control' id='registerEmail' onChange={handleChange} required></input>
            </div>
            <div className='mb-2'>
                <label htmlFor='registerPass' className='form-label'>Password</label>
                <input type='password' name='password' className='form-control' id='registerPass' onChange={handleChange} required></input>
            </div>
            <div className='mb-2'>
                <label htmlFor='registerConfirm' className='form-label'>Confirm Password</label>
                <input type='password' name='confirm' className='form-control' id='registerConfirm' onChange={handleChange} required></input>
            </div>
            <div className='d-grid gap-2 mb-2'>
                <button type='submit' className='btn btn-success'>Register</button>
            </div>
        </form>
  )
}

function RegisterButton (props) {
  return (
        <button onClick={props.onClick} className='btn btn-success'>Register</button>
  )
}

function LoginButton (props) {
  return (
        <button onClick={props.onClick} className='btn btn-success'>Login</button>
  )
}

function LoginController (props) {
  const [loginActive, setLoginActive] = useState(false)
  const [registerActive, setRegisterActive] = useState(false)

  function toggleLoginStatus () {
    loginActive ? setLoginActive(false) : setLoginActive(true)
  }

  function toggleRegister () {
    registerActive ? setRegisterActive(false) : setRegisterActive(true)
  }

  if (loginActive) {
    return (
            <div className='row'>
                <LoginForm
                    onLogin={props.onRegister}
                    onDismiss={toggleLoginStatus} />
            </div>
    )
  }

  if (registerActive) {
    return (
            <div className='row'>
                <RegisterForm
                    onRegister={props.onRegister}
                    onDismiss={toggleRegister} />
            </div>
    )
  }
  return (
        <div className='row'>
            <div className='col'>
                <h3>New User?</h3>
                <RegisterButton
                    onClick={toggleRegister} />
            </div>
            <div className='col'>
                <h3 >Back Again?</h3>
                <LoginButton
                    onClick={toggleLoginStatus} />
            </div>
        </div>
  )
}

export default LoginController
