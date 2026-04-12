import { Router } from 'express';
import {
  createPlugin,
  deletePlugin,
  listPlugins,
  updatePlugin,
} from '../controllers/plugins';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

router.get('/plugins', auth, requirePermission('manage-plugins'), listPlugins);
router.post('/create-plugin', auth, requirePermission('manage-plugins'), createPlugin);
router.put('/update-plugin', auth, requirePermission('manage-plugins'), updatePlugin);
router.post('/delete-plugin', auth, requirePermission('manage-plugins'), deletePlugin);

export default router;
