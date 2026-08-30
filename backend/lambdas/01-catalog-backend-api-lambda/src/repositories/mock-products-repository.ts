import { readFile } from "node:fs/promises";
import type { Product, ProductsRepository } from "./types.js";

const seed = JSON.parse(
  await readFile(new URL("../../fixtures/products.json", import.meta.url), "utf8"),
) as Product[];

const products = new Map(seed.map((product) => [product.id, product]));

export class MockProductsRepository implements ProductsRepository {
  async list(): Promise<Product[]> {
    return Array.from(products.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async create(product: Product): Promise<Product> {
    products.set(product.id, product);
    return product;
  }
}
