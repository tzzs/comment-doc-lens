/** Formats the order status. */
fun formatStatus(status: String): String = status

/** Presents order data. */
class OrderPresenter {
    fun label(): String = formatStatus("paid")
}
