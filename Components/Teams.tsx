import { Button, Col, List, ListInlineItem, Row } from 'reactstrap'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useState } from 'react'
import InvitesAndJoinRequests from './authenticated/InvitesAndJoinRequests'
import { Id } from '../convex/_generated/dataModel'

export default function Teams(props: any) {
  const teamList = useQuery(api.team.list, props)
  const participant = useQuery(api.participant.readParticipant, props)
  const requestJoin = useMutation(api.participant.requestJoin)
  const invite = useMutation(api.participant.inviteToTeam)
  const [joinButtonMessage, setJoinButtonMessage] = useState('Join Team')
  const [inviteButtonMessage, setInviteBtnMsg] = useState('Invite to Team')

  const handleJoinClick = (id: Id<'teams'>) => {
    requestJoin({ id })
    setJoinButtonMessage('Join requested!')
  }

  const handleInviteClick = (joinerId: Id<'users'>) => {
    invite({ joinerId, competitionId: props.competitionId })
    setInviteBtnMsg('Invite sent!')
  }

  return (
    <Row>
      <Col md={6}>
        <InvitesAndJoinRequests />
      </Col>
      <Col md={6}>
        <List className="p-0">
          {teamList?.map((item) => (
            <li key={item._id} className="border p-2 m-1 list-unstyled">
              <List className="mb-4">
                {item.members.map((member) => (
                  <ListInlineItem>
                    <img
                      src={member.pictureURL}
                      width={50}
                      alt={'Profile picture of ' + member.name}
                    />{' '}
                    {member.name}
                    <Button
                      className="ms-2"
                      color="primary"
                      hidden={
                        participant &&
                        participant.userMembership.team == item._id
                      }
                      onClick={() => {
                        handleInviteClick(member._id)
                      }}
                    >
                      {inviteButtonMessage}
                    </Button>
                  </ListInlineItem>
                ))}
              </List>
              <Button
                hidden={
                  participant && participant.userMembership.team == item._id
                }
                disabled={!participant}
                color="primary"
                onClick={() => {
                  handleJoinClick(item._id)
                }}
              >
                {joinButtonMessage}
              </Button>
            </li>
          ))}
        </List>
      </Col>
    </Row>
  )
}