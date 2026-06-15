# Formats the order status.
# @param status [String]
def format_status(status)
  status
end

# Presents order data.
class OrderPresenter
  def label
    format_status("paid")
  end
end
