import { createRoute } from "honox/factory";
import { ReceiptList } from "../../../islands/ReceiptList";

export default createRoute(async (c) => {
  const { LINE_LIFF_FRONT_ID } = c.env;

  return c.render(<ReceiptList liffId={LINE_LIFF_FRONT_ID} />);
});
