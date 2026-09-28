import { Router } from 'express';
import {
  allowedActions,
  checkPermission,
  list,
} from '../controllers/publicApi';
import { auth } from '../middleware/auth';
import { accessConfig } from '../controllers/pluginAccessConfig';

const router = Router();

router.get('/access-config/:id', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
}, accessConfig);

router.get('/check-permission', auth, checkPermission);
router.get('/allowed-actions', auth, allowedActions);
router.get('/list', list);

export default router;
