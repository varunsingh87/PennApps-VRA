import { List, ListInlineItem } from 'reactstrap'
import type { Doc } from '../../convex/_generated/dataModel'

export default function TeamMembers({
  members,
}: {
  members: Array<Doc<'users'>>
}) {
  return (
    <List className="mb-4 border p-2">
      {members.map((member) => (
        <ListInlineItem key={member._id}>
          <img
            src={member.pictureURL}
            width={50}
            alt={'Profile picture of ' + member.name}
          />{' '}
          {member.name}
        </ListInlineItem>
      ))}
    </List>
  )
}
