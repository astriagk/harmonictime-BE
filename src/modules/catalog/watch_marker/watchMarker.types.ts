import { ObjectId } from "mongodb";

export interface WatchMarker {
  _id?: ObjectId;
  WatchMarkerName: string;
}
