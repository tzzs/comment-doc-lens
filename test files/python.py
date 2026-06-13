"""Python fixture for Comment Doc Lens."""


def format_order_status(status):
    """Format the order status for display.

    Used by order list views.
    """
    return status


class OrderPresenter:
    """Builds order labels."""

    def display_label(self, status):
        """Return the display label for a status."""
        return format_order_status(status)


presenter = OrderPresenter()
label = presenter.display_label("paid")
