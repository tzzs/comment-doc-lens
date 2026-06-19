/** Presents order data. */
public class OrderPresenter {
  /** Format the order status. */
  public String formatStatus(String status) {
    return status;
  }

  /** Shared order label. */
  public static final String ORDER_LABEL = "order";

  public String displayLabel() {
    return ORDER_LABEL + ": " + formatStatus("paid");
  }
}
