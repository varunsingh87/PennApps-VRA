import { Button, Container, List, ListInlineItem } from 'reactstrap'
import { Id } from '../../convex/_generated/dataModel'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import TeamMembers from '../team/TeamMembers'
import CrossChat from './CrossChat'
import { useState } from 'react'

export default function CrossChatList(props: {
	competitionId: Id<'competitions'>
}) {
	const crossChats = useQuery(api.crosschat.listForUser, props)
	const teamCrossChats = useQuery(api.crosschat.listForTeam, props)
	const [currentCrossChat, setCurrentCrossChat] = useState('')

	if (typeof crossChats == 'undefined' || typeof teamCrossChats == 'undefined') {
		return <h1>Loading...</h1>
	}

	return (
		<Container>
			{<Button onClick={() => setCurrentCrossChat('')}>{'<'}</Button>}
			{currentCrossChat ? <CrossChat joinRequestId={currentCrossChat as Id<'join_requests'>} /> : (
				<List>
					{crossChats.concat(teamCrossChats).map(crossChat => (
						<li key={crossChat.joinRequest._id} className="d-block" onClick={() => setCurrentCrossChat(crossChat.joinRequest._id)}>
							<TeamMembers members={[...crossChat.teamMembers, crossChat.joiner]} />
						</li>
					))}
				</List>
			)}
		</Container>

	)
}