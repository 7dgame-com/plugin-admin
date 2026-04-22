import { Router } from 'express';
import {
  allowedActions,
  checkPermission,
  list,
} from '../controllers/publicApi';
import { auth } from '../middleware/auth';

const router = Router();

router.get('/check-permission', auth, checkPermission);
router.get('/allowed-actions', auth, allowedActions);
router.get('/list', list);

export default router;
