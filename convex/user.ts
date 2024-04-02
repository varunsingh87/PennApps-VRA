import { query } from './_generated/server'
import { v } from 'convex/values'
import { mutation } from './_generated/server'
import authConfig from './auth.config'
import { Auth, GenericDatabaseReader, UserIdentity } from 'convex/server'
import { DataModel } from './_generated/dataModel'

/**
 * Verifies and returns the user with the given authentication
 * @param db The Convex database reader
 * @param auth The authentication object
 * @return Row of user in table
 */
export const verifyUser = async (
  db: GenericDatabaseReader<DataModel>,
  auth: Auth
) => {
  const identity = await authConfig.verify(auth)
  const user = await db
    .query('users')
    .withIndex('primary', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier)
    )
    .collect()
  return user[0]
}

/**
 * Wrapper hook around verifyUser
 */
export const getUser = query({
  args: {},
  handler: ({ db, auth }) => {
    return verifyUser(db, auth)
  },
})

export const storeUser = mutation({
  args: { bio: v.string() },
  handler: async ({ db, auth }, { bio }) => {
    const identity: UserIdentity = await authConfig.verify(auth)

    // Check if we've already stored this identity before.
    //filter for users
    const user = await verifyUser(db, auth)
    if (typeof user !== 'undefined') {
      // If we've seen this identity before but the name has changed, patch the value.
      if (user.name != identity.nickname && user.name != identity.name) {
        await db.patch<'users'>(user._id, {
          name: identity.nickname || identity.name!,
        })
      }
      if (user.pictureURL != identity.pictureUrl) {
        await db.patch<'users'>(user._id, { pictureURL: identity.pictureUrl! })
      }
      if (user.bio != bio && bio != '') {
        await db.patch<'users'>(user._id, { bio: bio! })
      }
      return user._id
    }

    // If it's a new identity, create a new `User`.
    return db.insert('users', {
      name: identity.nickname || identity.name!,
      tokenIdentifier: identity.tokenIdentifier,
      pictureURL: identity.pictureUrl!,
      bio: bio || '',
      // The `_id` field will be assigned by the backend.
    })
  },
})
