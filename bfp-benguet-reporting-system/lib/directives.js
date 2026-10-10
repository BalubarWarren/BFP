// Fields returned for a Directive by /api/directives and /api/directives/[id].
export const DIRECTIVE_SELECT = {
  id: true,
  kind: true,
  status: true,
  reportType: true,
  message: true,
  dueAt: true,
  response: true,
  respondedAt: true,
  createdAt: true,
  updatedAt: true,
  municipalityId: true,
  senderId: true,
  recipientId: true,
  sender: { select: { id: true, name: true, rank: true } },
  recipient: { select: { id: true, name: true, rank: true } },
};
