/// Formats the order status.
func formatStatus(_ status: String) -> String {
    status
}

/// Presents order data.
struct OrderPresenter {
    func label() -> String {
        formatStatus("paid")
    }
}
