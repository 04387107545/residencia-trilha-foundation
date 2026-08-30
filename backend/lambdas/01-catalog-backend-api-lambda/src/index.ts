import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { getProductsRepository } from "./repositories/index.js";
import type { ProductInput } from "./repositories/types.js";

type JsonBody = Record<string, unknown>;

type ProductRequest = {
  name?: string;
  description?: string;
  priceCents?: number;
  stock?: number;
  image?: {
    fileName?: string;
    contentType?: string;
  };
};

type JwtClaims = Record<string, unknown>;

class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}

const s3 = new S3Client({});

const json = (statusCode: number, body: JsonBody): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const parseBody = (event: APIGatewayProxyEventV2): ProductRequest => {
  if (!event.body) return {};

  return JSON.parse(
    event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body,
  ) as ProductRequest;
};

const claimsFrom = (event: APIGatewayProxyEventV2): JwtClaims => {
  const requestContext = event.requestContext as unknown as {
    authorizer?: { jwt?: { claims?: JwtClaims } };
  };
  const authorizer = requestContext.authorizer;
  return authorizer?.jwt?.claims ?? {};
};

const groupsFrom = (claims: JwtClaims): string[] => {
  const value = claims["cognito:groups"];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [value];
  } catch {
    return value.split(/[ ,]+/).filter(Boolean);
  }
};

const requireSeller = (event: APIGatewayProxyEventV2): string => {
  const claims = claimsFrom(event);
  if (!groupsFrom(claims).includes("seller")) {
    throw new HttpError("Only sellers can create products.", 403);
  }

  if (typeof claims.sub !== "string") {
    throw new HttpError("Seller identity is missing.", 401);
  }

  return claims.sub;
};

const safeFileName = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, "-");

const createImageUpload = async ({
  productId,
  sellerId,
  image,
}: {
  productId: string;
  sellerId: string;
  image?: ProductRequest["image"];
}) => {
  if (!image?.fileName) return null;

  const bucket = process.env.PRODUCT_IMAGES_BUCKET;
  if (!bucket) throw new Error("PRODUCT_IMAGES_BUCKET is required for image uploads.");

  const key = `${sellerId}/${productId}/${safeFileName(image.fileName)}`;
  const expiresIn = Number(process.env.UPLOAD_URL_TTL_SECONDS ?? 900);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: image.contentType ?? "application/octet-stream",
  });

  return {
    bucket,
    key,
    expiresIn,
    uploadUrl: await getSignedUrl(s3, command, { expiresIn }),
  };
};

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const repository = await getProductsRepository();

    if (method === "GET" && path === "/products") {
      return json(200, { items: await repository.list() });
    }

    if (method === "POST" && path === "/products") {
      const sellerId = requireSeller(event);
      const input = parseBody(event);
      if (!input.name || !Number.isInteger(input.priceCents) || !Number.isInteger(input.stock)) {
        return json(400, { message: "name, priceCents and stock are required." });
      }

      const id = randomUUID();
      const imageUpload = await createImageUpload({
        productId: id,
        sellerId,
        image: input.image,
      });
      const product: ProductInput = {
        id,
        name: input.name,
        description: input.description ?? "",
        priceCents: input.priceCents as number,
        stock: input.stock as number,
        sellerId,
        imageKey: imageUpload?.key ?? null,
        createdAt: new Date().toISOString(),
      };

      return json(201, { product: await repository.create(product), imageUpload });
    }

    return json(404, { message: "Route not found." });
  } catch (error) {
    const failure = error instanceof Error ? error : new Error("Unknown error");
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    console.error("catalog-request-failed", { message: failure.message, stack: failure.stack });
    return json(statusCode, {
      message: statusCode === 500 ? "Internal server error." : failure.message,
    });
  }
};
