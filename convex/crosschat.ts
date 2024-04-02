import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { verifyUser } from './user'
import { findTeamOfUser, validateCrossChatParticipation, verifyTeam } from './lib/team'
import { DELETED_USER, fulfillAndFlatten } from './lib/helpers'

/**
 * List the cross chats for a user's join requests (join requests that started with the user's consent)
 */
export const listForUser = query({
  args: { competitionId: v.id('competitions') },
  handler: async ({ db, auth }, args) => {
    const user = await verifyUser(db, auth);
    const joinRequests = await db.query('join_requests')
      .withIndex('by_user', q => q.eq('user', user._id))
      .collect()

    return fulfillAndFlatten(
      joinRequests
        .filter(async item => {
          const team = await db.get(item.team)
          return team && team.competition == args.competitionId
        })
        .map(async item => {
          const team = await verifyTeam(db, item.team)
          if (!team) return []
          const joiner = await db.get(item.user)
          if (!joiner) return []

          return [{
            joinRequest: item,
            joiner,
            teamMembers: team.members
          }]
        })
    )
  }
})

/**
 * List the cross chats for a team's invites (join requests that started with the consent of the team of this user)
 */
export const listForTeam = query({
  args: { competitionId: v.id('competitions') },
  handler: async ({ db, auth }, args) => {
    const user = await verifyUser(db, auth);
    const team = await findTeamOfUser(db, user, args.competitionId)
    if (!team) return []

    return fulfillAndFlatten(team.joinRequests
        .map(async item => {
          const team = await verifyTeam(db, item.team)
          if (!team) return []
          const joiner = await db.get(item.user)
          if (!joiner) return []
          return [{
            joinRequest: item,
            joiner,
            teamMembers: team.members
          }]
        })
    )
  }
})

/**
 * Sends a message to a cross-chat regarding a join request
 * @return id of the message if successful
 * @throws ConvexError If the user is not part of the cross-chat
 */
export const sendMessage = mutation({
  args: { joinRequest: v.id('join_requests'), message: v.string() },
  handler: async ({ db, auth }, { joinRequest, message}) => {
    const sender = await verifyUser(db, auth)

    const joinRequestInfo = await db.get(joinRequest)
    if (!joinRequestInfo)
      throw new ConvexError({ code: 404, msg: 'No join request exists for the chat'})

    const userIsInChat = await validateCrossChatParticipation(db, joinRequestInfo, sender._id)
    if (!userIsInChat)
      throw new ConvexError({ code: 403, msg: 'Permission denied: Not in chat' })

    return await db.insert('join_messages', {
      join_request: joinRequest,
      message,
      sender: sender._id
    })
  }
})

/**
 * Gets a cross chat including documents of each user
 * @return List of messages in the cross chat associated with the join request including document for each sender
 * @throws ConvexError If the join request does not exist or the user does not have permission to view the cross chat,
 * which is the case when the user is not on the team and not the joiner in the join request
 */
export const listMessages = query({
  args: { request: v.id('join_requests')},
  handler: async ({ db, auth }, { request }) => {
    const joinRequest = await db.get(request)
    const viewer = await verifyUser(db, auth)
    if (!joinRequest)
      throw new ConvexError({ code: 404, msg: 'Request not found' })

    const userIsInChat = await validateCrossChatParticipation(db, joinRequest, viewer._id)
    if (!userIsInChat)
      throw new ConvexError({ code: 403, msg: 'Permission denied: Not in chat' })

    const messages = await db
      .query('join_messages')
      .withIndex('by_request',
          q => q.eq('join_request', joinRequest._id)
      ).collect()

    return Promise.all(messages.map(async message => {
      return {
        ...message,
        ownMessage: message.sender == viewer._id,
        sender: await db.get(message.sender) ?? DELETED_USER,
      }
    }))
  }
})