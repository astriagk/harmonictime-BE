// Business role ids stored on Roles.RoleID / UserRoles.RoleID.
export enum RoleId {
  ADMIN = 1,
  SELLER = 2,
  CUSTOMER = 3,
}

export const DEFAULT_ROLE_ID = RoleId.CUSTOMER;
