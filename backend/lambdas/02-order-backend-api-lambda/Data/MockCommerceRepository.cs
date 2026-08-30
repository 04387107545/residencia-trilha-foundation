namespace Residencia.Foundation.Orders.Data;

public sealed class MockCommerceRepository : ICommerceRepository
{
    private static readonly IReadOnlyDictionary<string, ProductReference> Products =
        new Dictionary<string, ProductReference>
        {
            ["product-001"] = new("product-001", "seller-demo", 12),
            ["product-002"] = new("product-002", "seller-demo", 8),
        };

    private static readonly IReadOnlyList<SellerOrder> Orders =
    [
        new(
            "order-demo-001",
            "buyer-demo",
            "seller-demo",
            "product-001",
            1,
            "processed",
            DateTimeOffset.Parse("2026-01-03T12:00:00Z")
        ),
    ];

    public Task<ProductReference?> FindProduct(string productId) =>
        Task.FromResult(Products.GetValueOrDefault(productId));

    public Task<IReadOnlyList<SellerOrder>> ListSellerOrders(string sellerId) =>
        Task.FromResult<IReadOnlyList<SellerOrder>>(
            Orders.Where(order => order.SellerId == sellerId).ToArray()
        );
}
