import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { SellerBankAccount } from "./bank_account.types";

class BankAccountRepository extends BaseRepository<SellerBankAccount> {
  constructor() {
    super(COLLECTIONS.SELLER_BANK_ACCOUNTS);
  }

  findBySeller(sellerId: ObjectId) {
    return this.find({ SellerID: sellerId });
  }

  // Clear the default flag on this seller's other accounts (so only one is default).
  clearDefault(sellerId: ObjectId, except?: ObjectId) {
    return this.updateMany(
      { SellerID: sellerId, IsDefault: true, ...(except ? { _id: { $ne: except } } : {}) },
      { $set: { IsDefault: false } }
    );
  }
}

export const bankAccountRepository = new BankAccountRepository();
