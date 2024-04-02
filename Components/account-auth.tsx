import { useAuth0 } from '@auth0/auth0-react'
import { useRouter } from 'next/router'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

export function Login() {
  const { isLoading, loginWithRedirect } = useAuth0()
  if (isLoading) {
    return <p>Loading...</p>
  }
  return (
    <button className="btn btn-primary" onClick={() => loginWithRedirect({})}>
      Log in
    </button>
  )
}

export function Logout() {
  const router = useRouter()
  const { logout } = useAuth0()
  const user = useQuery(api.user.getUser)
  return (
    <div className="float-end">
      {/* We know this component only renders if the user is logged in. */}
      <img
        onClick={() => router.push('/profile')}
        src={user?.pictureURL}
        alt=""
        width="35"
        height="35"
        className="rounded-circle float-start me-3"
      />
      <button
        className="btn btn-secondary float-end"
        onClick={() =>
          logout({ logoutParams: { returnTo: window.location.origin } })
        }
      >
        Log out
      </button>
    </div>
  )
}
