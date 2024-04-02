import { Col, List, ListInlineItem, Row } from 'reactstrap'
import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import InvitesAndJoinRequests from './authenticated/UserInvites'
import InviteButton from './team/InviteButton'
import JoinRequestButton from './team/JoinRequestButton'
import CrossChatList from './chat/CrossChatList'

export default function Teams(props: any) {
	const teamList = useQuery(api.team.list, props)
	const { isAuthenticated } = useConvexAuth()

	return (
		<Row>
			<Col md={3}>
				{isAuthenticated ? (
					<InvitesAndJoinRequests competitionId={props.competitionId} />
				) : null}
			</Col>
			<Col md={5}>
				<h1>All Teams</h1>
				<List className="p-0">
					{teamList?.map((team) => (
						<li key={team._id} className="border p-2 m-1 list-unstyled">
							<List className="mb-4">
								{team.members.map((member) => (
									<ListInlineItem key={member._id}>
										<img
											src={member.pictureURL}
											width={50}
											alt={'Profile picture of ' + member.name}
										/>{' '}
										{member.name}
										{isAuthenticated ? (
											<InviteButton
												competitionId={props.competitionId}
												joiner={member}
												teamOfJoiner={team}
											/>
										) : null}
									</ListInlineItem>
								))}
							</List>
							{isAuthenticated ? (
								<JoinRequestButton
									competitionId={props.competitionId}
									teamId={team._id}
								/>
							) : null}
						</li>
					))}
				</List>
			</Col>
			<Col md={4}>
				<h1>Cross Chat</h1>
				<CrossChatList competitionId={props.competitionId} />
			</Col>
		</Row>
	)
}
