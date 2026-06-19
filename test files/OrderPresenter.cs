public class OrderPresenter
{
    /// <summary>
    /// Formats the order status.
    /// </summary>
    public string FormatStatus(string status)
    {
        return status;
    }

    public string DisplayLabel()
    {
        return FormatStatus("paid");
    }
}
