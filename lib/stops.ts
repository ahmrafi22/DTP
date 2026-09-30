import { NODES } from "./network";

/** Human label for a stop id, falling back to the id if it is unknown. */
export const stopName = (id: string): string => NODES[id]?.name ?? id;
