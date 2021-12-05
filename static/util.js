'use strict'
const { useState, useEffect, useContext } = React;

//TODO: BETTER NAME! we're going to, at the very least, route contexts out of this file. 

const anonymousUser = {id: 0, name: "", email: ""}
const UserContext = React.createContext(anonymousUser)
const NotifyContext = React.createContext(null)