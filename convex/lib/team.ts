import { Auth, GenericDatabaseReader, GenericDatabaseWriter } from 'convex/server'
import { DataModel, Doc, Id } from '../_generated/dataModel'
import { RequestValidity } from '../../lib/shared'
import { ConvexError } from 'convex/values'
import { convertToUserDocumentArray, fulfillAndFlatten } from './helpers'
import { verifyUser } from '../user'

/**
 * Adds a join request and opens a cross chat with the pitch as the first message
 * @param db The database object (write access required for DB INSERT)
 * @param auth The authentication object for verifying the user
 * @param inviterTeamId The id of the team that is considering/requesting the invite
 * @param joinerId The id of the joiner that may switch teams
 * @param pitch The first message in the cross chat between the joiner and the inviting team
 * @param teamConsent Whether the join request is an invite
 * @return {Id<'join_requests'>} Id of the new join request
 */
export async function recordJoinRequest(db: GenericDatabaseWriter<DataModel>, auth: Auth, inviterTeamId: Id<'teams'>, joinerId: Id<'users'>, pitch: string, teamConsent: boolean) {
  const user = await verifyUser(db, auth);
  const newJoinRequest = await db.insert('join_requests', {
    team: inviterTeamId,
    user: joinerId,
    userConsent: !teamConsent,
    teamConsent
  })
  await db.insert('join_messages', {
    join_request: newJoinRequest,
    sender: user._id,
    message: pitch
  })

  return newJoinRequest
}

/**
 * Lists the teams and competition a user is in
 * @param db The database object. Note: must be a writer for the above side effect
 * @param user The user whose teams/competitions are getting listed
 */
export async function listOwnParticipations(
  db: GenericDatabaseReader<DataModel>,
  user: Doc<'users'>
) {
  const participations = await db
    .query('participants')
    .withIndex('by_user', (q) => q.eq('user', user._id))
    .collect()

  return await fulfillAndFlatten(
    participations.map(async (item) => {
      const team = await db.get(item.team)
      if (!team) return [] // Skip if the team does not exist

      const competition = await db.get(team.competition)
      if (!competition) return [] // Skip if the competition does not exist

      return [
        {
          participation: item,
          team,
          competition,
        },
      ]
    })
  )
}

/**
 * Efficient utility function for getting the information about a team given a user and competition
 * @param db The database reader object
 * @param user A user on the team
 * @param competition The competition this team is entered in
 * @return object containing information about team or false if the team does not exist
 */
export async function findTeamOfUser(
  db: GenericDatabaseReader<DataModel>,
  user: Doc<'users'>,
  competition: Id<'competitions'>
) {
  const ownParticipations = await listOwnParticipations(db, user)
  const currentParticipation = ownParticipations.find(
    (item) => item?.competition?._id == competition
  )
  if (!currentParticipation || !currentParticipation.team) return false

  const teamAndMembers = await verifyTeam(db, currentParticipation.team._id)

  return {
    ...teamAndMembers,
    userMembership: currentParticipation.participation,
  }
}

/**
 * Determines whether a join *request* for a user to a team is valid or invalid
 * and specifies the invalidity of the request
 *
 * Precondition: The team exists
 * @param db The database
 * @param inviterTeam The team that the user would like to join
 * @param joiner The user who would like to join the team
 * @return The validity of the join request
 *
 * @throws Error If one of the following conditions is true:
 * - The user is not in the competition that the team is in
 */
export async function validateTeamJoinRequest(
  db: GenericDatabaseReader<DataModel>,
  inviterTeam: Doc<'teams'>,
  joiner: Doc<'users'>
): Promise<RequestValidity> {
  const inviterTeamParticipants = await db
    .query('participants')
    .withIndex('by_team', (q) => q.eq('team', inviterTeam._id))
    .collect()
  const requestorMembership = inviterTeamParticipants.findIndex(
    (item) => item.user == joiner._id
  )
  if (requestorMembership > -1) {
    return RequestValidity.BACKWARDS
  }

  if (inviterTeamParticipants.length >= 4) {
    return RequestValidity.FULL
  }

  const joinerTeam = await findTeamOfUser(db, joiner, inviterTeam.competition)
  if (!joinerTeam) {
    throw new ConvexError('The user is not in the competition')
  }
  if (joinerTeam.members.length > 1) {
    return RequestValidity.COMMITTED
  }

  const invitingTeamJoinRequests = await db.query('join_requests')
    .withIndex('by_team', q => q.eq('team', inviterTeam._id))
    .collect()

  const joinRequest = invitingTeamJoinRequests.find(
    (item) => item.user == joiner._id
  )
  if (!joinRequest) {
    return RequestValidity.VALID
  } else if (joinRequest.teamConsent && joinRequest.userConsent) {
    return RequestValidity.ACCEPTED
  } else if (joinRequest.teamConsent && !joinRequest.userConsent) {
    return RequestValidity.INVITED
  } else if (!joinRequest.teamConsent && joinRequest.userConsent) {
    return RequestValidity.REQUESTED
  } else {
    return RequestValidity.VALID
  }
}

/**
 * Adds the user to a team and clears the join request
 *
 * Preconditions:
 *  - Both parties have consented to adding the user (a join request indicating this exists for the team)
 *  AKA validateTeamJoinRequest returns ACCEPTED
 *  - User is in the competition
 *
 * Postconditions:
 * - The join request for the user to the team no longer exists
 * - the user's team is team
 * @param db The database object
 * @param user The user joining the team
 * @param invitingTeam The team the user will be added to
 * @throws ConvexError The user is not in the competition
 */
export async function addUserToTeam(
  db: GenericDatabaseWriter<DataModel>,
  user: Doc<'users'>,
  invitingTeam: Doc<'teams'>
) {
  const userToTeamJoinRequest = await db
    .query('join_requests')
    .withIndex('by_team',
        q => q.eq('team', invitingTeam._id)
    )
    .filter(q => q.eq(q.field('user'), user._id))
    .first()
  if (userToTeamJoinRequest)
    await db.delete(userToTeamJoinRequest._id)

  const teamOfJoiner = await findTeamOfUser(db, user, invitingTeam.competition)
  if (!teamOfJoiner) {
    throw new ConvexError('The user is not in the competition')
  }

  const participations = await db
    .query('participants')
    .withIndex('by_team', (q) => q.eq('team', teamOfJoiner._id))
    .collect()
  const joinerParticipation = participations.find(
    (item) => item.user == user._id
  )
  if (!joinerParticipation) {
    throw new ConvexError('An internal server error occurred')
  }

  // Assigns the new team to the user
  await db.patch(joinerParticipation._id, { team: invitingTeam._id })

  // Delete the team and don't ban the user if the team is only the user
  if (teamOfJoiner.members.length == 1) {
    return await db.delete(teamOfJoiner._id)
  }
}

/**
 * Gets a list of the teams in a competition with the participants
 * @param db Database object (DB read access)
 * @param competitionId Id of the competition
 */
export async function listCompetitionTeams(
  db: GenericDatabaseReader<DataModel>,
  competitionId: Id<'competitions'>
) {
  const teamRows = await db
    .query('teams')
    .withIndex('by_competition', (q) => q.eq('competition', competitionId))
    .collect()
  const fullTeamInfo = teamRows.map(async (item) => verifyTeam(db, item._id))

  return Promise.all(fullTeamInfo)
}

/**
 * Gets the information on a team independent of a user
 * @param db Database object
 * @param teamId Id of the team getting read
 * @return object containing the team info (top-level properties) and members (array)
 */
export async function verifyTeam(
  db: GenericDatabaseReader<DataModel>,
  teamId: Id<'teams'>
) {
  const team = await db.get(teamId)
  if (!team)
    throw new ConvexError({ code: 404, message: 'The team does not exist' })

  const memberRows = await db
    .query('participants')
    .withIndex('by_team', (q) => q.eq('team', teamId))
    .collect()
  const members = await convertToUserDocumentArray(
    db,
    memberRows.map((item) => item.user)
  )

  const joinRequests = await db.query('join_requests')
    .withIndex('by_team', q => q.eq('team', teamId))
    .collect()

  return {
    ...team,
    members,
    joinRequests
  }
}

/**
 * Validates whether a user can see and send messages in a cross chat
 * @param db The database object
 * @param joinRequestInfo The join request that gives info on the team and user joining the team
 * @param viewer The user who is trying to send a message or view the chat
 */
export async function validateCrossChatParticipation(
  db: GenericDatabaseReader<DataModel>,
  joinRequestInfo: Doc<'join_requests'>,
  viewer: Id<'users'>
): Promise<boolean> {

  const invitingTeam = await verifyTeam(db, joinRequestInfo.team)
  return invitingTeam.members.some(member => member._id == viewer) ||
    joinRequestInfo.user == viewer
}


