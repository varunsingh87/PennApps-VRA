import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { verifyUser } from './user'
import { findTeamOfUser, listCompetitionTeams, verifyTeam } from './lib/team'
import { includeUserDocument } from './lib/helpers'

/**
 * List teams in a competition
 */
export const list = query({
  args: { competitionId: v.id('competitions') },
  handler: async ({ db }, { competitionId }) => {
    const competitionTeams = await listCompetitionTeams(db, competitionId)
    competitionTeams.sort((a, b) => a.members.length - b.members.length)
    return competitionTeams
  },
})

/**
 * Gets the team the user is on
 */
export const get = query({
  args: { competitionId: v.id('competitions') },
  handler: async ({ db, auth }, { competitionId }) => {
    const user = await verifyUser(db, auth)
    const teamInfo = await findTeamOfUser(db, user, competitionId)
    if (!teamInfo) {
      throw new ConvexError({
        code: 404,
        message: 'No team exists for a competition you are not in',
      })
    }
    const messages = await db
      .query('team_messages')
      .withIndex('by_team', (q) => q.eq('team', teamInfo._id))
      .collect()

    const joinRequests = await includeUserDocument(db, teamInfo.joinRequests)

    return {
      ...teamInfo,
      messages: await Promise.all(
        messages.map(async (item) => {
          return {
            ...item,
            ownMessage: item.sender == user._id,
            sender: await db.get(item.sender),
          }
        })
      ),
      joinRequests: joinRequests.filter((item) => item.userConsent),
      invitations: joinRequests.filter((item) => item.teamConsent),
    }
  },
})

export const sendMessage = mutation({
  args: { teamId: v.id('teams'), message: v.string() },
  handler: async ({ db, auth }, { teamId, message }) => {
    const user = await verifyUser(db, auth)
    const team = await verifyTeam(db, teamId)

    const userIsOnTeam = team.members.some((item) => item._id == user._id)
    if (!userIsOnTeam) {
      throw new ConvexError({
        code: 403,
        message:
          'Permission denied: You can only send chat messages to your own team',
      })
    }

    return await db.insert('team_messages', {
      team: teamId,
      sender: user._id,
      message,
    })
  },
})
