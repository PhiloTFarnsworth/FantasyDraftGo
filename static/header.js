const { useState, useEffect, useContext } = React;
function Welcome(props) {
    const User = useContext(UserContext)
    if (User.name === '') {
        return <p className='text-white text-center mt-3'>Welcome Guest!</p>
    }
    return <p className='text-white text-center mt-3'>Welcome {User.name}!</p>
}

function Header(props) {
    const User = useContext(UserContext)
    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-3">
            <div className='container-fluid text-center'>
            <div className='col'>
            <Welcome />
            </div>
            <div className='col-6'>
                <a className='navbar-brand' href=''>
                    Fantasy Draft
                </a>
            </div>
            <div className='col'>
                {User.id === '0' ? '' : <a href='\logout'><button className='btn btn-warning'>logout</button></a>}
            </div>
            </div>
        </nav>
    )
}