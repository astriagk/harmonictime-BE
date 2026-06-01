import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { asyncHandler } from "../../../shared/middlewares/asyncHandler";
import { ApiError } from "../../../shared/utils/apiError";
import { sendResponse } from "../../../shared/utils/apiResponse";
import { HTTP_STATUS } from "../../../shared/constants/httpStatus";
import { gstRepository } from "./gst.repository";
import { uploadFile, deleteFile } from "../../../shared/services/file-storage.service";
import { GSTDocument } from "./gst.types";
import { userRoleRepository } from "../role/role.repository";
import { userRepository } from "../user/user.repository";
import { RoleId } from "../../../shared/constants/roles";

// Determine the next sellerVerificationStatus when a seller updates their GST.
// Rejected → Resubmitted (signals admin to re-review)
// Approved → Pending    (details changed, needs re-verification)
// Anything else stays Pending
const nextVerificationStatus = (current?: string): string => {
  if (current === "Rejected") return "Resubmitted";
  if (current === "Approved") return "Pending";
  return "Pending";
};

// Assign Seller role and mark accountType as "business" if not already done.
const ensureSellerRole = async (userId: ObjectId): Promise<void> => {
  const [existing, user] = await Promise.all([
    userRoleRepository.find({ UserID: userId, RoleID: RoleId.SELLER } as any),
    userRepository.findById(userId.toString()),
  ]);

  await Promise.all([
    existing.length === 0
      ? userRoleRepository.insertOne({
          UserRoleID: RoleId.SELLER,
          UserID: userId,
          RoleID: RoleId.SELLER,
        })
      : Promise.resolve(),
    user?.accountType !== "business"
      ? userRepository.updateById(userId.toString(), { accountType: "business" } as any)
      : Promise.resolve(),
  ]);
};

const sellerObjectId = (req: Request): ObjectId => {
  const userId = req.user?.userId;
  if (!userId || !ObjectId.isValid(userId))
    throw ApiError.unauthorized("Invalid session");
  return new ObjectId(userId);
};

export const createGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);

    const existing = await gstRepository.findBySeller(userId);
    if (existing) throw ApiError.conflict("GST details already exist. Use PUT to update.");

    const duplicate = await gstRepository.findByGSTIN(req.body.GSTIN.toUpperCase());
    if (duplicate) throw ApiError.conflict("This GSTIN is already registered with another account.");

    const result = await gstRepository.insertOne({
      UserID: userId,
      GSTIN: req.body.GSTIN.toUpperCase(),
      LegalBusinessName: req.body.LegalBusinessName,
      TradeName: req.body.TradeName,
      BusinessType: req.body.BusinessType,
      RegisteredAddress: req.body.RegisteredAddress,
      State: req.body.State,
      PinCode: req.body.PinCode,
      Documents: req.body.Documents,
      IsVerified: false,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
    });

    await ensureSellerRole(userId);

    sendResponse(res, HTTP_STATUS.CREATED, "GST details saved successfully", result);
  }
);

export const getGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);
    const gst = await gstRepository.findBySeller(userId);
    if (!gst) throw ApiError.notFound("GST details not found");
    sendResponse(res, HTTP_STATUS.OK, "GST details retrieved successfully", gst);
  }
);

export const updateGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);
    const { id } = req.params;

    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid GST record id");

    const [gst, user] = await Promise.all([
      gstRepository.findById(id),
      userRepository.findById(userId.toString()),
    ]);
    if (!gst || gst.UserID.toString() !== userId.toString())
      throw ApiError.notFound("GST details not found");

    if (req.body.GSTIN) {
      const upper = req.body.GSTIN.toUpperCase();
      const duplicate = await gstRepository.findByGSTIN(upper);
      if (duplicate && duplicate._id!.toString() !== id)
        throw ApiError.conflict("This GSTIN is already registered with another account.");
      req.body.GSTIN = upper;
    }

    const newStatus = nextVerificationStatus(user?.sellerVerificationStatus);

    await Promise.all([
      gstRepository.updateById(new ObjectId(id), {
        ...req.body,
        IsVerified: false,
        UpdatedAt: new Date(),
      }),
      userRepository.updateById(userId.toString(), { sellerVerificationStatus: newStatus } as any),
    ]);

    sendResponse(res, HTTP_STATUS.OK, "GST details updated successfully");
  }
);

export const deleteGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);
    const { id } = req.params;

    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid GST record id");

    const gst = await gstRepository.findById(id);
    if (!gst || gst.UserID.toString() !== userId.toString())
      throw ApiError.notFound("GST details not found");

    await gstRepository.deleteById(new ObjectId(id));
    sendResponse(res, HTTP_STATUS.OK, "GST details deleted successfully");
  }
);

// Upload files to S3 and build the Documents array. Returns uploaded URLs so
// the caller can delete them from S3 if a subsequent DB operation fails.
const uploadDocumentFiles = async (
  files: Express.Multer.File[],
  userId: string,
  documentTypes: string[]
): Promise<GSTDocument[]> => {
  const folder = `gst-documents/${userId}`;
  return Promise.all(
    files.map(async (file, i) => {
      const url = await uploadFile(file, folder);
      const key = new URL(url).pathname.substring(1);
      return { url, key, documentType: documentTypes[i] as GSTDocument["documentType"] };
    })
  );
};

const deleteUploadedFiles = (docs: GSTDocument[]) =>
  Promise.allSettled(docs.map((d) => deleteFile(d.key ?? d.url)));

// Create GST + upload documents in one request (multipart/form-data).
// If the DB insert fails, uploaded S3 files are cleaned up automatically.
export const createGSTWithDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);

    const existing = await gstRepository.findBySeller(userId);
    if (existing) throw ApiError.conflict("GST details already exist. Use PUT to update.");

    const gstin = (req.body.GSTIN as string)?.trim().toUpperCase();
    const duplicate = await gstRepository.findByGSTIN(gstin);
    if (duplicate) throw ApiError.conflict("This GSTIN is already registered with another account.");

    const files = (req.files as Express.Multer.File[]) ?? [];
    let documentTypes: string[] = [];
    try {
      documentTypes = req.body.documentTypes ? JSON.parse(req.body.documentTypes) : [];
    } catch {
      documentTypes = [];
    }

    const uploadedDocs = files.length > 0
      ? await uploadDocumentFiles(files, userId.toString(), documentTypes)
      : [];

    try {
      const result = await gstRepository.insertOne({
        UserID: userId,
        GSTIN: gstin,
        LegalBusinessName: req.body.LegalBusinessName,
        TradeName: req.body.TradeName,
        BusinessType: req.body.BusinessType,
        RegisteredAddress: req.body.RegisteredAddress,
        State: req.body.State,
        PinCode: req.body.PinCode,
        Documents: uploadedDocs.length > 0 ? uploadedDocs : undefined,
        IsVerified: false,
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
      });

      await ensureSellerRole(userId);
      sendResponse(res, HTTP_STATUS.CREATED, "GST details saved successfully", result);
    } catch (err) {
      await deleteUploadedFiles(uploadedDocs);
      throw err;
    }
  }
);

// Update GST + documents in one request (multipart/form-data).
// Pass `removedDocKeys` as a JSON array of S3 keys to delete from S3 after a
// successful save. S3 deletion happens only after the DB update succeeds.
export const updateGSTWithDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = sellerObjectId(req);
    const { id } = req.params;

    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid GST record id");

    const [gst, user] = await Promise.all([
      gstRepository.findById(id),
      userRepository.findById(userId.toString()),
    ]);
    if (!gst || gst.UserID.toString() !== userId.toString())
      throw ApiError.notFound("GST details not found");

    if (req.body.GSTIN) {
      const upper = (req.body.GSTIN as string).trim().toUpperCase();
      const duplicate = await gstRepository.findByGSTIN(upper);
      if (duplicate && duplicate._id!.toString() !== id)
        throw ApiError.conflict("This GSTIN is already registered with another account.");
      req.body.GSTIN = upper;
    }

    const files = (req.files as Express.Multer.File[]) ?? [];
    let documentTypes: string[] = [];
    let existingDocs: GSTDocument[] = [];
    let removedDocKeys: string[] = [];
    try {
      documentTypes = req.body.documentTypes ? JSON.parse(req.body.documentTypes) : [];
      existingDocs = req.body.existingDocs ? JSON.parse(req.body.existingDocs) : [];
      removedDocKeys = req.body.removedDocKeys ? JSON.parse(req.body.removedDocKeys) : [];
    } catch {
      // malformed JSON — treat as empty
    }

    const uploadedDocs = files.length > 0
      ? await uploadDocumentFiles(files, userId.toString(), documentTypes)
      : [];

    const newStatus = nextVerificationStatus(user?.sellerVerificationStatus);

    try {
      const { documentTypes: _dt, existingDocs: _ed, removedDocKeys: _rk, ...textFields } = req.body;

      await Promise.all([
        gstRepository.updateById(new ObjectId(id), {
          ...textFields,
          Documents: [...existingDocs, ...uploadedDocs],
          IsVerified: false,
          UpdatedAt: new Date(),
        }),
        userRepository.updateById(userId.toString(), { sellerVerificationStatus: newStatus } as any),
      ]);
    } catch (err) {
      await deleteUploadedFiles(uploadedDocs);
      throw err;
    }

    // Delete removed docs from S3 only after the DB update succeeded
    if (removedDocKeys.length > 0) {
      await Promise.allSettled(removedDocKeys.map((key) => deleteFile(key)));
    }

    sendResponse(res, HTTP_STATUS.OK, "GST details updated successfully");
  }
);

// Admin: list all GST records
export const adminListGSTDetails = asyncHandler(
  async (_req: Request, res: Response) => {
    const records = await gstRepository.find({});
    sendResponse(res, HTTP_STATUS.OK, "GST records retrieved successfully", records);
  }
);

// Admin: mark GST as verified
export const adminVerifyGSTDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) throw ApiError.badRequest("Invalid GST record id");

    const gst = await gstRepository.findById(id);
    if (!gst) throw ApiError.notFound("GST details not found");

    await gstRepository.updateById(new ObjectId(id), {
      IsVerified: true,
      UpdatedAt: new Date(),
    });

    sendResponse(res, HTTP_STATUS.OK, "GST details verified successfully");
  }
);
