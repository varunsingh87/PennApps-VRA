import { Button, Container, Input, List } from 'reactstrap'
import React, { useState, KeyboardEvent } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Doc, Id } from '../convex/_generated/dataModel'
import classnames from 'classnames'
import { UserBubble } from './User'
import { FunctionReference } from 'convex/server'

type sendMessageFunction = (newMessage: string) => void;

export default function Chat(props: {
  sendMessage: sendMessageFunction;
  messages: Array<any>
}) {
  const [newMessage, setNewMessage] = useState('')

  const handleMessageSend = () => {
    if (!newMessage) return
    setNewMessage('')
    props.sendMessage(newMessage);
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
