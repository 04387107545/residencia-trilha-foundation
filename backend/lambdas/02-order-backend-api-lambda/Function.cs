using System.Text.Json;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using Amazon.Lambda.Serialization.SystemTextJson;
using Amazon.SQS;
using Amazon.SQS.Model;
using Residencia.Foundation.Orders.Data;

[assembly: LambdaSerializer(typeof(DefaultLambdaJsonSerializer))]

namespace Residencia.Foundation.Orders;

public sealed class Function
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ICommerceRepository _repository;
    private readonly IAmazonSQS _sqs;
    private readonly string _queueUrl;

    public Function()
        : this(
            RepositoryFactory.Create(),
            new AmazonSQSClient(),
            Environment.GetEnvironmentVariable("ORDER_QUEUE_URL")
                ?? throw new InvalidOperationException("ORDER_QUEUE_URL is required.")
        )
    {
    }

    internal Function(ICommerceRepository repository, IAmazonSQS sqs, string queueUrl)
    {
        _repository = repository;
        _sqs = sqs;
        _queueUrl = queueUrl;
    }

    public async Task<APIGatewayProxyResponse> FunctionHandler(
        APIGatewayProxyRequest request,
        ILambdaContext context
    )
    {
        try
        {
            var method = request.HttpMethod;
            var path = request.Path;
            var claims = request.RequestContext.Authorizer?.Claims
                ?? new Dictionary<string, string>();

            if (method == "POST" && path == "/orders")
                return await CreateOrder(request, claims);

            if (method == "GET" && path == "/orders")
                return await ListBuyerOrders(claims);

            if (method == "GET" && path == "/seller/orders")
                return await ListSellerOrders(claims);

            return Json(404, new { message = "Route not found." });
        }
        catch (Exception exception)
        {
            context.Logger.LogError(
                "order-request-failed: {Message}\n{StackTrace}",
                exception.Message,
                exception.StackTrace
            );
            return Json(500, new { message = "Internal server error." });
        }
    }

    private async Task<APIGatewayProxyResponse> CreateOrder(
        APIGatewayProxyRequest request,
        IDictionary<string, string> claims
    )
    {
        var input = JsonSerializer.Deserialize<CreateOrderRequest>(request.Body ?? "{}", JsonOptions);
        if (input is null || string.IsNullOrWhiteSpace(input.ProductId) || input.Quantity <= 0)
            return Json(400, new { message = "productId and a positive quantity are required." });

        var product = await _repository.FindProduct(input.ProductId);
        if (product is null) return Json(404, new { message = "Product not found." });
        if (product.Stock < input.Quantity) return Json(409, new { message = "Insufficient stock." });

        var orderId = Guid.NewGuid().ToString();
        var orderEvent = new OrderCreatedEvent(
            orderId,
            RequiredClaim(claims, "sub"),
            product.SellerId,
            product.Id,
            input.Quantity,
            DateTimeOffset.UtcNow,
            orderId
        );

        await _sqs.SendMessageAsync(new SendMessageRequest
        {
            QueueUrl = _queueUrl,
            MessageBody = JsonSerializer.Serialize(orderEvent, JsonOptions),
        });

        return Json(202, new { orderId, status = "accepted" });
    }

    private async Task<APIGatewayProxyResponse> ListSellerOrders(
        IDictionary<string, string> claims
    )
    {
        var orders = await _repository.ListSellerOrders(RequiredClaim(claims, "sub"));
        return Json(200, new { items = orders });
    }

    private async Task<APIGatewayProxyResponse> ListBuyerOrders(
        IDictionary<string, string> claims
    )
    {
        var orders = await _repository.ListBuyerOrders(RequiredClaim(claims, "sub"));
        return Json(200, new { items = orders });
    }

    private static string RequiredClaim(IDictionary<string, string> claims, string name) =>
        claims.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new InvalidOperationException($"JWT claim {name} is required.");

    private static APIGatewayProxyResponse Json(int statusCode, object body) => new()
    {
        StatusCode = statusCode,
        Headers = new Dictionary<string, string>
        {
            ["content-type"] = "application/json",
            ["access-control-allow-origin"] = Environment.GetEnvironmentVariable("ALLOWED_ORIGIN") ?? "*",
            ["access-control-allow-headers"] = "Content-Type,Authorization",
            ["access-control-allow-methods"] = "GET,POST,PUT,DELETE,OPTIONS",
        },
        Body = JsonSerializer.Serialize(body, JsonOptions),
    };
}
