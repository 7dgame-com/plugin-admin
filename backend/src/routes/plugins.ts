import { Router } from 'express';
import {
  createPlugin,
  deletePlugin,
  listPlugins,
  updatePlugin,
} from '../controllers/plugins';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { requireRootRole } from '../middleware/root';

const router = Router();

router.get('/plugins', auth, requireRootRole, requirePermission('manage-plugins'), listPlugins);
router.post('/create-plugin', auth, requireRootRole, requirePermission('manage-plugins'), createPlugin);
router.put('/update-plugin', auth, requireRootRole, requirePermission('manage-plugins'), updatePlugin);
router.post('/delete-plugin', auth, requireRootRole, requirePermission('manage-plugins'), deletePlugin);

export default router;
