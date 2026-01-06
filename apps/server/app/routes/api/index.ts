import { Hono } from "hono";
import { companyAuthMiddleware } from "../../middlewares/companyAuthMiddleware";
import { currentUserMiddleware } from "../../middlewares/currentUserMiddleware";
import { lineAuthMiddleware } from "../../middlewares/lineAuthMiddleware";
import { receiptsRoute } from "./receipts";
import { registrationRoute } from "./registration";
import { transactionRoute } from "./transaction";

const app = new Hono();

app.get("/link/wallet_txn", (c) => {
  return c.redirect("freee://wallet_txn");
});

// /transaction配下: lineAuth + currentUser + companyAuth
app.use(
  "/transaction/*",
  lineAuthMiddleware,
  currentUserMiddleware,
  companyAuthMiddleware,
);

// /receipts配下: lineAuth + currentUserのみ
app.use("/receipts/*", lineAuthMiddleware, currentUserMiddleware);

// /registration配下: lineAuthのみ
app.use("/registration/*", lineAuthMiddleware);

const routes = app
  .route("/registration", registrationRoute)
  .route("/transaction", transactionRoute)
  .route("/receipts", receiptsRoute);

export type AppType = typeof routes;

export default app;
