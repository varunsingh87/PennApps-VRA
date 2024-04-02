import React, { createContext, useCallback, useContext, useState } from 'react'
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap'

/**
 * @see https://stackoverflow.com/a/62937123/9860982
 * @type {React.Context<unknown>}
 */
const AlertContext = createContext()

export function AlertProvider(props) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState()
  const [onContinue, setOnContinue] = useState(() => {})

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  const handleOpen = useCallback(
    (message, onContinue) => {
      setMessage(message)
      setOnContinue(() => onContinue)
      setOpen(true)
    },
    [setMessage, setOnContinue, setOpen]
  )

  const handleContinueClick = () => {
    setOpen(false)
    onContinue()
  }

  return (
    <AlertContext.Provider value={[handleOpen, handleClose]}>
      {props.children}
      <Modal color="warning" isOpen={open} toggle={handleClose}>
        <ModalBody className={'px-3'}>{message}</ModalBody>
        <ModalFooter>
          <Button color="danger" onClick={handleContinueClick}>
            Continue
          </Button>{' '}
          <Button color="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context)
    throw new Error(
      '`useAlert()` must be called inside an `AlertProvider` child.'
    )

  return context
}
