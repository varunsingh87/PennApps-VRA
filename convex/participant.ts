import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { verifyUser } from './user'
import {
  findTeamOfUser,
  addUserToTeam,
  validateTeamJoinRequest, recordJoinRequest
} from './lib/team'
import { RequestValidity } from '../lib/shared'

/**
 * Gets the information about the logged-in user for a competition and the user's teams
 */
export const readParticipant = query({
  args: { competitionId: v.id('competitions') },
  handler: async ({ db, auth }, { competitionId }) => {
    const user = await verifyUser(db, auth)
    return await findTeamOfUser(db, user, competitionId)
  },
})

export const readInvites = query({
  args: { competitionId: v.id('competitions') },
  handler: async ({ db, auth }, { competitionId }) => {
    const user = await verifyUser(db, auth)
    const userTeam = await findTeamOfUser(db, user, competitionId)
    if (!userTeam) {
      return false
    }

    const teamsThatInvitedUser = await db
      .query('join_requests')
      .withIndex('by_user', q => q.eq('user', user._id))
      .filter(q => q.field('teamConsent'))
      .collect()

    const teamListWithTeammates = teamsThatInvitedUser.map(async joinRequest => {
      const teammates = await db.query('participants')
        .withIndex('by_team', q => q.eq('team', joinRequest.team))
        .collect()
      const teammatesWithInfo = []
      for (const teammate of teammates) {
        const user = await db.get(teammate.user);
        if (user)
          teammatesWithInfo.push({...teammate, user })
      }

      return { ...joinRequest, teammates: teammatesWithInfo }
    })

    return await Promise.all(teamListWithTeammates)
  }
})

/**
 * Create a new empty team for a competition and adds the user to the competition through that team
 * @return Id of new participants table row if successful
 */
export const joinCompetition = mutation({
  args: { id: v.id('competitions') },
  handler: async ({ db, auth }, { id }) => {
    const user = await verifyUser(db, auth)

    const competition = await db.get(id)
    if (!competition) {
      throw new ConvexError('That competition does not exist')
    }

    // Stop users who have left the competition and banned users from rejoining the competition
    if (competition.banned.includes(user._id)) {
      throw new ConvexError('You are not permitted to enter this competition')
    }

    // Check if the participant is already in the competition
    const userTeam = await findTeamOfUser(db, user, competition._id)
    if (userTeam) {
      throw new ConvexError('You already entered this competition')
    }

    // Add user to competition and create new team
    const team = await db.insert('teams', {
      competition: id,
    })

    return await db.insert('participants', { user: user._id, team })
  },
})

/**
 * Records request for a user to join a team OR adds the user to the tam
 *
 * Precondition: User's participation in the competition is valid
 *
 * Postcondition: If the joiner was already invited, adds the user to the team because both sides have consented.
 * If no such join request exists, records the join request.
 * The user also cannot request to join any other team
 * @param id The id of the team that the user would like to join
 */
export const requestJoin = mutation({
  args: { id: v.id('teams'), pitch: v.optional(v.string()) },
  handler: async (
    { db, auth },
    { id, pitch = 'Hey there! I would like to join your team.' }
  ) => {
    const user = await verifyUser(db, auth)
    const inviterTeam = await db.get(id)
    if (!inviterTeam) {
      throw new ConvexError('The inviting team does not exist')
    }

    const requestValidity = await validateTeamJoinRequest(db, inviterTeam, user)
    switch (requestValidity) {
      // Repeat request
      case RequestValidity.REQUESTED:
        throw new ConvexError('The request has already been made')
      case RequestValidity.VALID:
        // Record the join request
        await recordJoinRequest(db, auth, inviterTeam._id, user._id, pitch, false)
        return RequestValidity.VALID
      case RequestValidity.INVITED:
        return await addUserToTeam(db, user, inviterTeam)
      default:
        return requestValidity
    }
  },
})

/**
 * Records a join request with the team's consent to an invitee OR adds a user to the team
 *
 * Postcondition: If a join request by the joiner is already made, adds the user to the team because both sides have
 * consented.
 * If no such join request exists, records the join request.
 *
 * @param joinerId The user who is not on the team
 * @param competitionId The id of the competition that the team is in
 */
export const inviteToTeam = mutation({
  args: {
    joinerId: v.id('users'),
    competitionId: v.id('competitions'),
    pitch: v.optional(v.string()),
  },
  handler: async (
    { db, auth },
    {
      joinerId,
      competitionId,
      pitch = 'Hey there! We would love for you to join our team. ',
    }
  ) => {
    const inviter = await verifyUser(db, auth)
    const inviterTeam = await findTeamOfUser(db, inviter, competitionId)
    if (!inviterTeam) {
      throw new ConvexError('The user is not in that competition')
    }

    const joiner = await db.get(joinerId)
    if (!joiner) {
      throw new ConvexError('The user getting invited does not exist')
    }

    // Add user to team if the join request was in
    const validation = await validateTeamJoinRequest(db, inviterTeam, joiner)
    switch (validation) {
      case RequestValidity.INVITED:
        throw new ConvexError('The invite was already made')
      case RequestValidity.VALID:
        // Record the join request
        await recordJoinRequest(db, auth, inviterTeam._id, joiner._id, pitch, true)
        return RequestValidity.VALID
      case RequestValidity.REQUESTED:
        return addUserToTeam(db, joiner, inviterTeam)
      default:
        return validation
    }
  },
})

/**
 * Permanently removes a user from a competition
 *
 * Preconditions:
 * - User is in the competition
 * - The competition exists
 *
 * Postconditions:
 * - User is banned from competition IFF the team was multi-person
 * - User is unassigned from team he was last on
 * - User is unassigned from competition
 * - All join requests for user to teams in the competition no longer exist
 * - ALl join requests for team no longer exist IFF the team is a singleton
 * - The team the user was on no longer exists IFF the team is a singleton
 * @param id The id of the competition
 * @throws ConvexError If not all preconditions are met
 */
export const leaveCompetition = mutation({
  args: { id: v.id('competitions') },
  handler: async ({ db, auth }, { id }) => {
    const competition = await db.get(id)
    if (!competition) {
      throw new ConvexError('That competition does not exist')
    }

    const user = await verifyUser(db, auth)
    const team = await findTeamOfUser(db, user, id)
    if (!team) {
      throw new ConvexError('User is not in that competition')
    }

    // Remove the user from the team and the competition
    await db.delete(team.userMembership._id)

    // Delete the team and don't ban the user if the team is only the user
    if (team.members.length == 1) {
      return await db.delete(team._id)
    }

    // Add user to "banned" to stop the user from rejoining
    competition.banned.push(user._id)
    return await db.replace(competition._id, competition)
  },
})
