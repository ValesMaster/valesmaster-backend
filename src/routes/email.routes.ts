import { Router } from "express";

import {

    sendEmailCode,

    verifyEmailCode

} from "../controllers/email.controller";

const router = Router();

router.post(
    "/send",
    sendEmailCode
);

router.post(
    "/verify",
    verifyEmailCode
);

export default router;