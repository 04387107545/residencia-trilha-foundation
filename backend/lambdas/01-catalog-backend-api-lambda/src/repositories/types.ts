export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  sellerId: string;
  imageKey: string | null;
  createdAt: string;
};

export type ProductInput = Product;

export interface ProductsRepository {
  list(): Promise<Product[]>;
  create(product: ProductInput): Promise<Product>;
}
