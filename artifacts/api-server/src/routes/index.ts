import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import agentsRouter from "./agents";
import sessionsRouter from "./sessions";
import transactionsRouter from "./transactions";
import clientsRouter from "./clients";
import feexpayRouter from "./feexpay";
import productsRouter from "./products";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/agents", agentsRouter);
router.use("/sessions", sessionsRouter);
router.use("/transactions", transactionsRouter);
router.use("/clients", clientsRouter);
router.use("/products", productsRouter);
router.use("/notifications", notificationsRouter);
router.use(feexpayRouter);

export default router;
