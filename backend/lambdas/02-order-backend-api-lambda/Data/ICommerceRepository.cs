namespace Residencia.Foundation.Orders.Data;

public interface ICommerceRepository
{
    Task<ProductReference?> FindProduct(string productId);
    Task<IReadOnlyList<SellerOrder>> ListBuyerOrders(string buyerId);
    Task<IReadOnlyList<SellerOrder>> ListSellerOrders(string sellerId);
}
