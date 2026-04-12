import { Router } from 'express';
import {
  createMenuGroup,
  deleteMenuGroup,
  listMenuGroups,
  updateMenuGroup,
} from '../controllers/menuGroups';
import { auth } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { requireRootRole } from '../middleware/root';

const router = Router();

router.get('/menu-groups', auth, requireRootRole, requirePermission('manage-plugins'), listMenuGroups);
router.post('/create-menu-group', auth, requireRootRole, requirePermission('manage-plugins'), createMenuGroup);
router.put('/update-menu-group', auth, requireRootRole, requirePermission('manage-plugins'), updateMenuGroup);
router.post('/delete-menu-group', auth, requireRootRole, requirePermission('manage-plugins'), deleteMenuGroup);

export default router;
