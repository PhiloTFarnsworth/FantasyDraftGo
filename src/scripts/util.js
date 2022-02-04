'use strict'
import React from 'react';


const anonymousUser = { ID: 0, name: "", email: "" }
export const UserContext = React.createContext(anonymousUser)
export const NotifyContext = React.createContext(null)

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

export default Notify