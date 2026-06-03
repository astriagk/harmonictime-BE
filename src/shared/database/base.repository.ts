import {
  Collection,
  Document,
  Filter,
  ObjectId,
  OptionalUnlessRequiredId,
  Sort,
  UpdateFilter,
  WithId,
} from "mongodb";
import { getDB } from "../config/database";

// Generic CRUD repository over a single MongoDB collection.
// Concrete repositories extend this and add domain-specific queries.
export class BaseRepository<T extends Document> {
  constructor(protected readonly collectionName: string) {}

  protected get collection(): Collection<T> {
    return getDB().collection<T>(this.collectionName);
  }

  toObjectId(id: string | ObjectId): ObjectId {
    return typeof id === "string" ? new ObjectId(id) : id;
  }

  async insertOne(doc: OptionalUnlessRequiredId<T>) {
    return this.collection.insertOne(doc);
  }

  async insertMany(docs: OptionalUnlessRequiredId<T>[]) {
    return this.collection.insertMany(docs);
  }

  async findById(id: string | ObjectId): Promise<WithId<T> | null> {
    return this.collection.findOne({ _id: this.toObjectId(id) } as unknown as Filter<T>);
  }

  async findOne(filter: Filter<T>): Promise<WithId<T> | null> {
    return this.collection.findOne(filter);
  }

  async find(filter: Filter<T> = {} as Filter<T>, sort?: Sort): Promise<WithId<T>[]> {
    const cursor = this.collection.find(filter);
    return (sort ? cursor.sort(sort) : cursor).toArray();
  }

  async updateById(id: string | ObjectId, update: Partial<T>) {
    return this.collection.updateOne(
      { _id: this.toObjectId(id) } as unknown as Filter<T>,
      { $set: update } as UpdateFilter<T>
    );
  }

  async updateOne(filter: Filter<T>, update: UpdateFilter<T>) {
    return this.collection.updateOne(filter, update);
  }

  async updateMany(filter: Filter<T>, update: UpdateFilter<T>) {
    return this.collection.updateMany(filter, update);
  }

  async deleteById(id: string | ObjectId) {
    return this.collection.deleteOne({ _id: this.toObjectId(id) } as unknown as Filter<T>);
  }

  async deleteOne(filter: Filter<T>) {
    return this.collection.deleteOne(filter);
  }

  async aggregate<R extends Document = Document>(pipeline: Document[]): Promise<R[]> {
    return this.collection.aggregate<R>(pipeline).toArray();
  }
}
