/** Formats the order status. */
std::string formatStatus(std::string status) {
  return status;
}

/// Presents order data.
class OrderPresenter {
 public:
  std::string label() {
    return formatStatus("paid");
  }
};
