import { NavLink } from 'react-router'
import { UnitToggle } from './UnitToggle'
import { useAuth } from '../hooks/useAuth'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'active' : ''
}

export function TopNav() {
  const { user, loading, signIn, signOut } = useAuth()

  return (
    <header className="top-nav">
      <h1 className="top-nav__title">Run Map</h1>
      <nav className="top-nav__links">
        <NavLink to="/" end className={navLinkClass}>
          Planner
        </NavLink>
        <NavLink to="/saved" className={navLinkClass}>
          Saved Routes
        </NavLink>
      </nav>
      <div className="top-nav__actions">
        <UnitToggle />
        {!loading &&
          (user ? (
            <div className="top-nav__account">
              {user.photoURL && <img src={user.photoURL} alt="" className="top-nav__avatar" />}
              <span className="top-nav__name">{user.displayName ?? user.email}</span>
              <button type="button" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void signIn()}>
              Sign in with Google
            </button>
          ))}
      </div>
    </header>
  )
}
