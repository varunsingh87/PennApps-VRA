import { Button, Container, Input, List } from 'reactstrap'
import React, { useState, KeyboardEvent } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import classnames from 'classnames'
import { UserBubble } from '../User'
import { Id } from '../../convex/_generated/dataModel'

export default function CrossChat(props: {
  joinRequestId: Id<'join_requests'>
}) {
  const sendMessage = useMutation(api.crosschat.sendMessage)
  const messages = useQuery(api.crosschat.listMessages, {
    request: props.joinRequestId
  })
  const [newMessage, setNewMessage] = useState('')

  const handleMessageSend = () => {
    if (!newMessage) return
    setNewMessage('')
    sendMessage({ message: newMessage, joinRequest: props.joinRequestId });
  }

  const handleEnterPressed = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleMessageSend()
  }

  return (
    <Container>
      <List className="p-0 mt-2">
        {messages?.map(msg => (
          <li
            className={classnames(
              'p-2',
              'list-unstyled',
              'd-flex',
              msg.ownMessage ? 'flex-row-reverse align-items-end' : ''
            )}
          >
            <UserBubble {...msg.sender} />
            <p className="border p-1 rounded mx-2">{msg.message}</p>
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
