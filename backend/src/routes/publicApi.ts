import { Router } from 'express';
import {
  allowedActions,
  checkPermission,
  list,
  verifyTokenProxy,
} from '../controllers/publicApi';
import { auth } from '../middleware/auth';

const router = Router();

router.get('/check-permission', auth, checkPermission);
router.get('/allowed-actions', auth, allowedActions);
router.get('/list', list);
router.get('/verify-token', verifyTokenProxy);

export default router;
