const { useState, useEffect } = React;

function Welcome(props) {
    if (props.user === '') {
        return <p className='text-white text-center mt-3'>Welcome Guest!</p>
    }
    return <p className='text-white text-center mt-3'>Welcome {props.user}!</p>
}

function Header(props) {
    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-3">
            <div className='container-fluid text-center'>
            <div className='col'>
            <Welcome user={props.user.name}/>
            </div>
            <div className='col-6'>
                <a className='navbar-brand' href=''>
                    Fantasy Draft
                </a>
            </div>
            <div className='col'>
                {props.user.id === '0' ? '' : <a href='\logout'><button className='btn btn-warning'>logout</button></a>}
            </div>
            </div>
        </nav>                
    )
}