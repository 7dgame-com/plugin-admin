import { Router } from 'express';
import { getDiagnostics } from '../controllers/diagnostics';
import { auth } from '../middleware/auth';
import { requireRootRole } from '../middleware/root';

const router = Router();

router.get('/', auth, requireRootRole, getDiagnostics);

export default router;
