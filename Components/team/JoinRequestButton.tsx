import {
  Button,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from 'reactstrap'
import { useState } from 'react'
import { Id } from '../../convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { RequestValidity } from '../../lib/shared'

export default function JoinRequestButton({
  competitionId,
  teamId,
}: {
  competitionId: Id<'competitions'>
  teamId: Id<'teams'>
}) {
  const [joinButtonMessage, setJoinButtonMessage] = useState('Join Team')
  const joiner = useQuery(api.participant.readParticipant, {
    competitionId,
  })
  const requestJoin = useMutation(api.participant.requestJoin)

  const [requestJoinModal, setRequestJoinModal] = useState(false)

  const toggleJoinRequestModal = () => setRequestJoinModal(!requestJoinModal)
  const handleJoinClick = async (id: Id<'teams'>) => {
    setRequestJoinModal(false)
    const joinRequest: RequestValidity | null = await requestJoin({ id })
    if (joinRequest != null && joinRequest >= 0) {
      setJoinButtonMessage('Join requested!')
    } else {
      setJoinButtonMessage('Invalid join request')
    }
    setTimeout(() => {
      setJoinButtonMessage('Join Team')
    }, 2000)
  }

  const handleJoinModalOpen = () => {
    setRequestJoinModal(true)
  }

  if (!joiner) {
    return null
  }

  return (
    <div>
      <Modal isOpen={requestJoinModal} toggle={toggleJoinRequestModal}>
        <ModalHeader toggle={toggleJoinRequestModal}>
          Request to Join
        </ModalHeader>
        <ModalBody>
          <Label>
            Pitch your skills and interests to this team to persuade them to let
            you join them
          </Label>
          <Input
            type="text"
            placeholder="Make sure to include contact information"
          />
        </ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={() => handleJoinClick(teamId)}>
            Join
          </Button>{' '}
          <Button color="secondary" onClick={toggleJoinRequestModal}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      <Button
        hidden={
          !joiner ||
          /* Can't join his/her own team */
          joiner.userMembership.team == teamId ||
          /* Can't join another team when the current user is committed to a team */
          joiner.members.length > 1
        }
        color="primary"
        onClick={handleJoinModalOpen}
      >
        {joinButtonMessage}
      </Button>
    </div>
  )
}
