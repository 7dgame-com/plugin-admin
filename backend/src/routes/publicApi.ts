import { Router } from 'express';
import {
  allowedActions,
  checkPermission,
  list,
  verifyTokenProxy,
} from '../controllers/publicApi';
import { auth } from '../middleware/auth';
import { requireRootRole } from '../middleware/root';

const router = Router();

router.get('/check-permission', auth, requireRootRole, checkPermission);
router.get('/allowed-actions', auth, requireRootRole, allowedActions);
router.get('/list', list);
router.get('/verify-token', auth, requireRootRole, verifyTokenProxy);

export default router;
