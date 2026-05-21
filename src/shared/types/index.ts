import { ObjectId } from "mongodb";

// Shared base shape — every collection document has an _id.
export interface BaseDocument {
  _id?: ObjectId;
}

export type ID = string | ObjectId;
