import { Request, Response } from "express";
import { Filter, ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { sendEmail } from "../../../shared/services/email.service";
import { env } from "../../../shared/config/env";
import { contactRepository } from "./contact.repository";
import { ContactMessage } from "./contact.types";

// Public: a visitor submits the Contact Us form. The submission is stored and a
// notification is emailed to CONTACT_RECIPIENT. Email failure never blocks the
// submission (sendEmail swallows its own errors).
export const createContactMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, email, phone, subject, message } = req.body;
    const doc: ContactMessage = {
      _id: new ObjectId(),
      name,
      email,
      phone,
      subject,
      message,
      isRead: false,
      createdAt: new Date(),
    };
    await contactRepository.insertOne(doc);

    if (env.CONTACT_RECIPIENT) {
      const body = [
        `Name: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        subject ? `Subject: ${subject}` : null,
        "",
        message,
      ]
        .filter((line) => line !== null)
        .join("\n");
      await sendEmail(
        env.CONTACT_RECIPIENT,
        subject ? `Contact form: ${subject}` : `New contact form submission from ${name}`,
        body
      );
    }

    sendResponse(res, HTTP_STATUS.CREATED, "Message sent successfully", doc);
  }
);

// List submissions (newest first). Optional `?isRead=true|false` filter.
export const getContactMessages = asyncHandler(
  async (req: Request, res: Response) => {
    const { isRead } = req.query;
    const filter: Filter<ContactMessage> = {};
    if (isRead === "true") filter.isRead = true;
    if (isRead === "false") filter.isRead = false;

    const messages = await contactRepository.findMessages(filter);
    sendResponse(res, HTTP_STATUS.OK, "", messages);
  }
);

export const getContactMessageById = asyncHandler(
  async (req: Request, res: Response) => {
    const message = await contactRepository.findById(req.params.id);
    if (!message) throw ApiError.notFound("Message not found");
    sendResponse(res, HTTP_STATUS.OK, "", message);
  }
);

export const markContactMessageRead = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await contactRepository.updateById(req.params.id, {
      isRead: true,
    });
    if (result.matchedCount === 0) throw ApiError.notFound("Message not found");
    sendResponse(res, HTTP_STATUS.OK, "Message marked as read");
  }
);

export const deleteContactMessage = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await contactRepository.deleteById(req.params.id);
    if (result.deletedCount === 0) throw ApiError.notFound("Message not found");
    sendResponse(res, HTTP_STATUS.OK, "Message deleted successfully");
  }
);
