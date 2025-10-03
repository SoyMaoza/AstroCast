import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css'; 
// import logo from './assets/Logo.png'
const Navbar = () => {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <Link to="/" className="navbar-brand">
                    {/* <img src={logo} alt="AstroCast" className="brand-logo" />  */}
                    <span className="brand-name">Astro Cast</span>
                </Link>
            </div>
                        <div className="navbar-links">
                <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                    Dashboard
                </Link>
                <Link to="/info" className={`nav-link ${isActive('/info') ? 'active' : ''}`}>
                    Recursos NASA
                </Link>
                <Link to="/equipo" className={`nav-link ${isActive('/equipo') ? 'active' : ''}`}>
                    Equipo
                </Link>
            </div>
            <div className="navbar-right">
                <button className="icon-button">
                    <i className="fas fa-search"></i>
                </button>
            </div>
        </nav>
    );
};

export default Navbar;