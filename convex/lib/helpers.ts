import { GenericDatabaseReader } from 'convex/server'
import { DataModel, Doc, Id } from '../_generated/dataModel'

/**
 * Callback function that converts an array of objects with a user id to an array of objects with a user object
 * @param db The database reader object
 * @param objectsWithUserIds The array of objects containing a field called user
 * which will be converted to a user document
 */
export function includeUserDocument(
  db: GenericDatabaseReader<DataModel>,
  objectsWithUserIds: { user: Id<'users'> }[]
) {
  const mapToUser = async (item: { user: Id<'users'> }) => {
    const user = await db.get(item.user)
    if (!user) return []
    return [
      {
        ...item,
        user,
      },
    ]
  }

  return fulfillAndFlatten(objectsWithUserIds.map(mapToUser))
}

/**
 * Callback function that converts an array of user ids into an array of the corresponding user documents
 * @param db The database reader object
 * @param userIdList The array of user ids
 */
export function convertToUserDocumentArray(
  db: GenericDatabaseReader<DataModel>,
  userIdList: Id<'users'>[]
): Promise<Doc<'users'>[]> {
  const mapToUser = async (userId: Id<'users'>) => {
    const user = await db.get(userId)
    if (!user) return []
    return [user]
  }

  return fulfillAndFlatten(userIdList.map(mapToUser))
}

/**
 * Utility method for fulfilling an array of promises resulting from a map function call
 * that returned arrays that need to be flattened into a single array
 * @param promiseList
 */
export async function fulfillAndFlatten(promiseList: Array<Promise<any>>) {
  const arr = await Promise.all(promiseList)
  return arr.flat()
}

export const DELETED_USER: Doc<'users'> = {
  _id: '0' as Id<'users'>,
  _creationTime: 0,
  pictureURL: '/deleted-user.svg',
  name: 'DeletedUser',
  bio: '',
  tokenIdentifier: ''
}

