namespace Residencia.Foundation.Orders;

public sealed record CreateOrderRequest(string ProductId, int Quantity);

public sealed record ProductReference(string Id, string SellerId, int Stock);

public sealed record SellerOrder(
    string Id,
    string BuyerId,
    string SellerId,
    string ProductId,
    int Quantity,
    string Status,
    DateTimeOffset CreatedAt
);

public sealed record OrderCreatedEvent(
    string OrderId,
    string BuyerId,
    string SellerId,
    string ProductId,
    int Quantity,
    DateTimeOffset OccurredAt,
    string IdempotencyKey
);
