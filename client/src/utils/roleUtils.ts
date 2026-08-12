export function getRoleNameFromUser(user: any): string {
  return user?.role
    ? typeof user.role === 'object'
      ? (user.role as any).name?.toLowerCase()
      : String(user.role).toLowerCase()
    : '';
}
