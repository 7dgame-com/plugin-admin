import { Router } from 'express';
import {
  createPlugin,
  deletePlugin,
  listPlugins,
  updatePlugin,
} from '../controllers/plugins';
import { auth } from '../middleware/auth';
import { requireRootRole } from '../middleware/root';

const router = Router();

router.get('/plugins', auth, requireRootRole, listPlugins);
router.post('/create-plugin', auth, requireRootRole, createPlugin);
router.put('/update-plugin', auth, requireRootRole, updatePlugin);
router.post('/delete-plugin', auth, requireRootRole, deletePlugin);

export default router;
