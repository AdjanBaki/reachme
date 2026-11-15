import {
  standInAi,
  standInBilling,
  standInContacts,
  standInEmail,
  standInLinkedIn,
} from "./standins";

/** Swap a stand-in for the real provider here when it is connected. */
export const integrations = {
  linkedin: standInLinkedIn,
  ai: standInAi,
  contacts: standInContacts,
  email: standInEmail,
  billing: standInBilling,
};

export type * from "./types";
