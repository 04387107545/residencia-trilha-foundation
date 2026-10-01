using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;

namespace Residencia.Foundation.Orders.Data;

public sealed class DynamoCommerceRepository : ICommerceRepository
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly string _tableName;

    public DynamoCommerceRepository()
        : this(
            new AmazonDynamoDBClient(),
            Environment.GetEnvironmentVariable("MARKETPLACE_TABLE_NAME")
                ?? throw new InvalidOperationException("MARKETPLACE_TABLE_NAME is required.")
        )
    {
    }

    internal DynamoCommerceRepository(IAmazonDynamoDB dynamoDb, string tableName)
    {
        _dynamoDb = dynamoDb;
        _tableName = tableName;
    }

    public async Task<ProductReference?> FindProduct(string productId)
    {
        var key = $"PRODUCT#{productId}";
        var response = await _dynamoDb.GetItemAsync(new GetItemRequest
        {
            TableName = _tableName,
            ConsistentRead = true,
            Key = new Dictionary<string, AttributeValue>
            {
                ["pk"] = new() { S = key },
            },
        });
        if (response.Item is null || response.Item.Count == 0) return null;
        return new ProductReference(
            response.Item["id"].S,
            response.Item["sellerId"].S,
            int.Parse(response.Item["stock"].N)
        );
    }

    public Task<IReadOnlyList<SellerOrder>> ListBuyerOrders(string buyerId) =>
        ListOrders("buyerId", buyerId);

    public Task<IReadOnlyList<SellerOrder>> ListSellerOrders(string sellerId) =>
        ListOrders("sellerId", sellerId);

    private async Task<IReadOnlyList<SellerOrder>> ListOrders(
        string ownerAttribute,
        string ownerId
    )
    {
        var response = await _dynamoDb.ScanAsync(new ScanRequest
        {
            TableName = _tableName,
            FilterExpression = "#entity = :order AND #owner = :owner",
            ExpressionAttributeNames = new Dictionary<string, string>
            {
                ["#entity"] = "entityType",
                ["#owner"] = ownerAttribute,
            },
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":order"] = new() { S = "ORDER" },
                [":owner"] = new() { S = ownerId },
            },
        });

        return response.Items.Select(item => new SellerOrder(
            item["id"].S,
            item["buyerId"].S,
            item["sellerId"].S,
            item["productId"].S,
            int.Parse(item["quantity"].N),
            item["status"].S,
            DateTimeOffset.Parse(item["createdAt"].S)
        )).OrderByDescending(order => order.CreatedAt).ToArray();
    }
}
