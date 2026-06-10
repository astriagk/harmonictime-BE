import { BaseRepository } from "../../../shared/database/base.repository";
import { COLLECTIONS } from "../../../shared/constants/collections";
import { Category } from "./category.types";

class CategoryRepository extends BaseRepository<Category> {
  constructor() {
    super(COLLECTIONS.CATEGORIES);
  }

  findByName(CategoryName: string) {
    return this.findOne({ CategoryName });
  }

  findAll() {
    return this.find({}, { CategoryName: 1 });
  }
}

export const categoryRepository = new CategoryRepository();
