import { Pool, type QueryResultRow } from "pg";
import type { Product, ProductsRepository } from "./types.js";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 2,
});

type ProductRow = QueryResultRow & {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  stock: number;
  seller_id: string;
  image_key: string | null;
  created_at: Date;
};

const mapProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  description: row.description,
  priceCents: row.price_cents,
  stock: row.stock,
  sellerId: row.seller_id,
  imageKey: row.image_key,
  createdAt: row.created_at.toISOString(),
});

export class RdsProductsRepository implements ProductsRepository {
  async list(): Promise<Product[]> {
    const result = await pool.query<ProductRow>(`
      SELECT id, name, description, price_cents, stock, seller_id, image_key, created_at
      FROM products
      ORDER BY created_at DESC
    `);

    return result.rows.map(mapProduct);
  }

  async create(product: Product): Promise<Product> {
    const result = await pool.query<ProductRow>(
      `
        INSERT INTO products (
          id, name, description, price_cents, stock, seller_id, image_key, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, description, price_cents, stock, seller_id, image_key, created_at
      `,
      [
        product.id,
        product.name,
        product.description,
        product.priceCents,
        product.stock,
        product.sellerId,
        product.imageKey,
        product.createdAt,
      ],
    );

    return mapProduct(result.rows[0]);
  }
}
