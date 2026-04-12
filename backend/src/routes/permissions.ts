import { Router } from 'express';
import {
  createPermission,
  deletePermission,
  listPermissions,
  updatePermission,
} from '../controllers/permissions';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { requireRootRole } from '../middleware/root';

const router = Router();

router.get('/permissions', auth, requireRootRole, requirePermission('manage-permissions'), listPermissions);
router.post('/create-permission', auth, requireRootRole, requirePermission('manage-permissions'), createPermission);
router.put('/update-permission', auth, requireRootRole, requirePermission('manage-permissions'), updatePermission);
router.post('/delete-permission', auth, requireRootRole, requirePermission('manage-permissions'), deletePermission);

export default router;
