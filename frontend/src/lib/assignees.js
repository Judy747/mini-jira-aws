/** Employees on the given team who may be assigned to its tasks. */
export function assigneesForTeam(users, teamId) {
  if (!teamId) return []
  return users.filter((u) => u.role === 'EMPLOYEE' && u.teamId === teamId)
}
