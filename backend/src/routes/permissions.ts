import { Router } from 'express';
import {
  createPermission,
  deletePermission,
  listPermissions,
  updatePermission,
} from '../controllers/permissions';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

router.get('/permissions', auth, requirePermission('manage-permissions'), listPermissions);
router.post('/create-permission', auth, requirePermission('manage-permissions'), createPermission);
router.put('/update-permission', auth, requirePermission('manage-permissions'), updatePermission);
router.post('/delete-permission', auth, requirePermission('manage-permissions'), deletePermission);

export default router;
