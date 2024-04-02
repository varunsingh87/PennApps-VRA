import { Button, Container, Input, List } from 'reactstrap'
import React, { useState, KeyboardEvent } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import classnames from 'classnames'
import { UserBubble } from '../User'

export default function TeamChat(props: {
  messages: Array<any>;
  teamId: Id<'teams'>
}) {
  const sendMessage = useMutation(api.team.sendMessage)
  const [newMessage, setNewMessage] = useState('')

  const handleMessageSend = () => {
    if (!newMessage) return
    setNewMessage('')
    sendMessage({ teamId: props.teamId, message: newMessage});
  }

  const handleEnterPressed = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleMessageSend()
  }

  return (
    <Container>
      <h1>Team Chat</h1>
      <List className="p-0 mt-2">
        {props.messages.map((item) => (
          <li
            className={classnames(
              'p-2',
              'list-unstyled',
              'd-flex',
              item.ownMessage ? 'flex-row-reverse align-items-end' : ''
            )}
          >
            <UserBubble {...item.sender} />
            <p className="border p-1 rounded mx-2">{item.message}</p>
          </li>
        ))}
      </List>
      <Container className="d-flex">
        <Input
          className="me-2 my-2"
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleEnterPressed}
        />
        <Button className="my-2" color="primary" onClick={handleMessageSend}>
          Chat
        </Button>
      </Container>
    </Container>
  )
}
