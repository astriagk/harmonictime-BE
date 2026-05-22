import { ObjectId } from "mongodb";

// A "Contact Us" form submission from a site visitor.
export interface ContactMessage {
  _id?: ObjectId;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}
