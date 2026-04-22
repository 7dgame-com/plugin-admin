import { Router } from 'express';
import {
  createPermission,
  deletePermission,
  listPermissions,
  updatePermission,
} from '../controllers/permissions';
import { auth } from '../middleware/auth';
import { requireRootRole } from '../middleware/root';

const router = Router();

router.get('/permissions', auth, requireRootRole, listPermissions);
router.post('/create-permission', auth, requireRootRole, createPermission);
router.put('/update-permission', auth, requireRootRole, updatePermission);
router.post('/delete-permission', auth, requireRootRole, deletePermission);

export default router;
