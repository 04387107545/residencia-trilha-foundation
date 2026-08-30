import type { OrderEvent, OrderProcessor, ProcessingResult } from "./types.js";

const processedOrders = new Set<string>();

export class MockOrderProcessor implements OrderProcessor {
  async process(order: OrderEvent): Promise<ProcessingResult> {
    if (processedOrders.has(order.idempotencyKey)) {
      return { status: "duplicate", orderId: order.orderId };
    }

    processedOrders.add(order.idempotencyKey);
    return {
      status: "processed",
      orderId: order.orderId,
      productId: order.productId,
      quantity: order.quantity,
    };
  }
}
