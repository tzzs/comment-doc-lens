/// Formats the order status.
/// Used by order list views.
pub fn format_status(status: &str) -> String {
    status.to_string()
}

pub enum OrderStatus {
    /// Paid order status.
    Paid,
}

/// Presents order data.
pub struct OrderPresenter;
