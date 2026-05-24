import { ObjectId } from "mongodb";
import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Withdrawal, WithdrawalStatus } from "./withdrawal.types";

class WithdrawalRepository extends BaseRepository<Withdrawal> {
  constructor() {
    super(COLLECTIONS.WITHDRAWALS);
  }

  findBySeller(sellerId: ObjectId, status?: WithdrawalStatus) {
    return this.find({
      SellerID: sellerId,
      ...(status ? { Status: status } : {}),
    });
  }

  findByStatus(status?: WithdrawalStatus) {
    return this.find(status ? { Status: status } : {});
  }
}

export const withdrawalRepository = new WithdrawalRepository();
