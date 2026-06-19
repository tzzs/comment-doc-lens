/// Formats the order status.
/// Used by order list views.
pub fn format_status(status: &str) -> String {
    status.to_string()
}

/// Represents supported order statuses.
pub enum OrderStatus {
    /// Paid order status.
    Paid,
}

/// Presents order data.
pub struct OrderPresenter;

/// Renders a sample order label.
pub fn render_order_label() -> String {
    let _presenter = OrderPresenter;
    let status = OrderStatus::Paid;

    format_status(match status {
        OrderStatus::Paid => "paid",
    })
}
